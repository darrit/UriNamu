// No npm dependencies: the bootstrap works before npm ci.
import { readFile, writeFile, mkdir, chmod, access, realpath } from 'node:fs/promises';
import { constants, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import nodeOs from 'node:os';
import { WEEK, mature, eligible, latest, compare, stable, verify, verifyApplePackage, visualStudioReleases, pool, keepInstalled, satisfies, parsePlist, partitionSnapshotPins, parseExactDependencyConflicts, parsePackageRecords, applyCompanionPins } from './setup-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const args = new Set(process.argv.slice(2));
for (const arg of args) if (!['--plan', '--frontend-only'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
const planOnly = args.has('--plan'), frontendOnly = args.has('--frontend-only');
const windows = process.platform === 'win32', mac = process.platform === 'darwin';
if (!['win32', 'darwin', 'linux'].includes(process.platform) || !['x64', 'arm64'].includes(process.arch)) throw new Error('Only Windows/macOS/Linux on x64/ARM64 are supported.');
const now = Date.now(), cutoff = new Date(now - WEEK).toISOString();
const local = path.join(root, '.setup');
await mkdir(local, { recursive: true });
const readJson = async p => JSON.parse(await readFile(path.join(root, p), 'utf8'));
const saveJson = async (p, data) => writeFile(path.join(root, p), JSON.stringify(data, null, 2) + '\n');
const policy = await readJson('dependency-policy.json');
if (policy.minimumAgeDays < 7 || Date.parse(policy.cutoff) > Date.parse(policy.evaluatedAt) - WEEK) throw new Error('Invalid project policy');
const report = { evaluatedAt: new Date(now).toISOString(), cutoff, platform: process.platform, arch: process.arch, frontendOnly, releases: [] };
const record = (name, release) => { mature(release.published, now); report.releases.push({ name, ...release }); };
const headers = { 'User-Agent': 'UriNamu-Setup/1.0', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
async function get(url, json = false) {
  if (!url.startsWith('https://')) throw new Error(`Nur HTTPS erlaubt: ${url}`);
  // Never send a GitHub token to registries or download servers.
  const response = await fetch(url, { headers: new URL(url).hostname === 'api.github.com' ? headers : { 'User-Agent': headers['User-Agent'] }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return json ? response.json() : Buffer.from(await response.arrayBuffer());
}
function run(command, argv = [], options = {}) {
  const result = spawnSync(command, argv, { cwd: root, env: process.env, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr?.toString() || result.status}`);
  return result.stdout?.toString().trim();
}
async function exists(p) { try { await access(p, constants.F_OK); return true; } catch { return false; } }
async function download(url, filename, hash, algorithm = 'sha256', verifyFile) {
  if (!hash || !url.startsWith('https://')) throw new Error('Download rejected: HTTPS and a checksum are required');
  const response = await fetch(url, { signal: AbortSignal.timeout(1800000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const digest = verifyFile ? null : createHash(algorithm), target = path.join(local, filename);
  await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, encoding, callback) { digest?.update(chunk); callback(null, chunk); } }), createWriteStream(target));
  if (verifyFile) await verifyFile(target);
  else if (digest.digest('hex').toLowerCase() !== hash.toLowerCase()) throw new Error(`${algorithm}-checksum mismatch: ${filename}`);
  return target;
}
async function checkedArchive(url, name) {
  const sums = (await get(url.slice(0, url.lastIndexOf('/')) + '/SHASUMS256.txt')).toString();
  const hash = sums.split('\n').find(line => line.trim().endsWith(`  ${name}`))?.split(/\s+/)[0];
  return download(url, name, hash);
}
const nodeIndex = await get('https://nodejs.org/dist/index.json', true);
const pinnedNode = nodeIndex.find(n => n.version === `v${policy.node}`);
if (!pinnedNode) throw new Error('The pinned Node release is missing from the official release index');
mature(pinnedNode.date, now);
const node = latest(nodeIndex.filter(n => n.lts).map(n => ({ version: n.version.slice(1), published: n.date })), policy.node.split('.')[0], now);
if (compare(node.version, policy.node) < 0) throw new Error('No eligible Node update; automatic downgrade is disabled.');
record('Node.js', { ...node, source: 'https://nodejs.org/dist/index.json' });
const npmMetadata = await get('https://registry.npmjs.org/npm', true);
const keepNode = keepInstalled(process.versions.node, node.version);
const effectiveNode = keepNode ? process.versions.node : node.version;
async function findNpm() {
  for (const directory of [...(process.env.URINAMU_ORIGINAL_PATH || process.env.PATH || '').split(path.delimiter), path.dirname(process.execPath)]) {
    const command = path.join(directory, windows ? 'npm.cmd' : 'npm');
    if (!(await exists(command))) continue;
    let cli = windows ? path.join(directory, 'node_modules/npm/bin/npm-cli.js') : await realpath(command);
    if (path.resolve(directory) === path.join(local, 'bin') && await exists(path.join(local, 'active-tools.json'))) {
      cli = (await readJson('.setup/active-tools.json')).npmCli;
    }
    if (!(await exists(cli))) continue;
    const result = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    const version = result.stdout?.trim();
    if (result.status === 0 && stable(version)) return { cli, version, bin: directory };
  }
  return null;
}
const installedNpm = await findNpm();
const npm = latest(Object.entries(npmMetadata.time).filter(([v]) => stable(v) && npmMetadata.versions[v] && !npmMetadata.versions[v].deprecated && satisfies(effectiveNode, npmMetadata.versions[v].engines?.node || '*'))
  .map(([version, published]) => ({ version, published })), policy.npm.split('.')[0], now);
if (compare(npm.version, policy.npm) < 0) throw new Error('The pinned npm release is too recent or incompatible; automatic downgrade is disabled.');
record('npm', { ...npm, source: 'https://registry.npmjs.org/npm' });
const keepNpm = keepInstalled(installedNpm?.version, npm.version);
report.existing = { node: { version: process.versions.node, action: keepNode ? 'keep' : 'install', minimum: node.version }, npm: { version: installedNpm?.version, action: keepNpm ? 'keep' : 'install', minimum: npm.version } };
console.log(`Node ${process.versions.node}: ${keepNode ? 'keep' : `replace with ${node.version}`}; npm ${installedNpm?.version || 'missing'}: ${keepNpm ? 'keep' : `replace with ${npm.version}`}`);

async function npmAudit() {
  const lock = await readJson('package-lock.json');
  const packages = new Map();
  for (const [location, item] of Object.entries(lock.packages)) {
    if (!location) continue;
    if (!item.version || !item.integrity || !item.resolved?.startsWith('https://registry.npmjs.org/')) throw new Error(`Unverifiable npm source: ${location}`);
    const name = location.split('node_modules/').at(-1);
    if (!packages.has(name)) packages.set(name, new Set());
    packages.get(name).add(item.version);
  }
  console.log(`Checking publication dates: ${packages.size} npm packages (including transitive dependencies).`);
  await pool([...packages], async ([name, versions]) => {
    const meta = name === 'npm' ? npmMetadata : await get(`https://registry.npmjs.org/${encodeURIComponent(name)}`, true);
    for (const version of versions) {
      if (version.split('+')[0].includes('-')) throw new Error(`Prerelease not allowed: ${name}@${version}`);
      record(`npm:${name}`, { version, published: meta.time[version] });
    }
  });
}
async function rustPlan() {
  const manifest = (await get(`https://static.rust-lang.org/dist/channel-rust-${policy.rust}.toml`)).toString();
  const published = manifest.match(/^date\s*=\s*"([^"]+)"/m)?.[1];
  record('Rust', { version: policy.rust, published });
  const ref = await get(`https://api.github.com/repos/rust-lang/rustup/git/ref/tags/${policy.rustup}`, true);
  const tag = ref.object.type === 'tag' ? await get(ref.object.url, true) : null;
  // A commit can predate publication of a lightweight tag. Its timestamp is not
  // release evidence: without an annotated tag require a published release.
  let date = tag?.tagger?.date;
  if (!date) {
    const release = await get(`https://api.github.com/repos/rust-lang/rustup/releases/tags/${policy.rustup}`, true);
    if (release.draft || release.prerelease || !release.published_at) throw new Error('No reliable rustup publication date');
    date = release.published_at;
  }
  record('rustup', { version: policy.rustup, published: date });
  const cargoText = await readFile(path.join(root, 'src-tauri/Cargo.lock'), 'utf8');
  const packages = cargoText.split('[[package]]').slice(1).flatMap(block => {
    const name = block.match(/^name = "([^"]+)"/m)?.[1], version = block.match(/^version = "([^"]+)"/m)?.[1];
    const source = block.match(/^source = "([^"]+)"/m)?.[1];
    if (!source) return [];
    if (source !== 'registry+https://github.com/rust-lang/crates.io-index') throw new Error(`Unverifiable Cargo source: ${source}`);
    return [{ name, version }];
  });
  const groups = new Map();
  for (const item of packages) { if (!groups.has(item.name)) groups.set(item.name, []); groups.get(item.name).push(item.version); }
  console.log(`Checking publication dates: ${groups.size} Rust crates (including transitive dependencies).`);
  await pool([...groups], async ([name, versions]) => {
    const relative = name.length === 1 ? `1/${name}` : name.length === 2 ? `2/${name}` : name.length === 3 ? `3/${name[0]}/${name}` : `${name.slice(0, 2)}/${name.slice(2, 4)}/${name}`;
    const rows = (await get(`https://index.crates.io/${relative}`)).toString().trim().split('\n').map(line => JSON.parse(line));
    for (const version of versions) {
      if (version.split('+')[0].includes('-')) throw new Error(`Cargo prerelease: ${name}@${version}`);
      const row = rows.find(r => r.vers === version);
      if (!row) throw new Error(`Crate missing: ${name}@${version}`);
      const published = row.pubtime || (await get(`https://crates.io/api/v1/crates/${name}/${version}`, true)).version.created_at;
      record(`cargo:${name}`, { version, published });
    }
  });
}

async function windowsPlan() {
  if (process.arch !== 'x64') throw new Error('Native Windows setup currently supports x64; use --frontend-only on ARM64.');
  const source = 'https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-history';
  const vs = latest(visualStudioReleases((await get(source)).toString()), 17, now);
  record('Visual Studio Build Tools', { ...vs, source });
  // A historical winget manifest proves that the exact installer bytes existed before cutoff.
  // Download the hashed standalone installer; never use winget's mutable evergreen URL.
  const manifestPath = 'manifests/m/Microsoft/EdgeWebView2Runtime';
  const commits = await get(`https://api.github.com/repos/microsoft/winget-pkgs/commits?path=${manifestPath}&until=${encodeURIComponent(cutoff)}&per_page=1`, true);
  if (!commits.length) throw new Error('No dated WebView2 manifest found');
  const commit = commits[0]; mature(commit.commit.committer.date, now);
  const directory = await get(`https://api.github.com/repos/microsoft/winget-pkgs/contents/${manifestPath}?ref=${commit.sha}`, true);
  const versions = directory.filter(d => /^\d+(\.\d+){3}$/.test(d.name)).sort((a, b) => compare(b.name, a.name));
  let webview;
  for (const version of versions.slice(0, 20)) {
    const files = await get(`https://api.github.com/repos/microsoft/winget-pkgs/contents/${manifestPath}/${version.name}?ref=${commit.sha}`, true);
    const file = files.find(f => f.name.endsWith('.installer.yaml'));
    if (!file) continue;
    const yaml = (await get(file.download_url)).toString();
    const block = yaml.split(/- Architecture: /).slice(1).find(s => s.startsWith('x64\n') || s.startsWith('x64\r\n'));
    const url = block?.match(/InstallerUrl:\s*(https:\/\/\S+)/)?.[1];
    const hash = block?.match(/InstallerSha256:\s*([a-fA-F0-9]{64})/)?.[1];
    if (url && hash && /^(msedge\.sf\.dl\.delivery\.mp\.microsoft\.com|msedge\.dl\.delivery\.mp\.microsoft\.com|download\.microsoft\.com)$/.test(new URL(url).hostname) && !/\/fwlink|aka\.ms/i.test(url)) {
      webview = { version: version.name, published: commit.commit.committer.date, url, hash, evidence: `https://github.com/microsoft/winget-pkgs/tree/${commit.sha}/${manifestPath}/${version.name}` }; break;
    }
  }
  if (!webview) throw new Error('No immutable dated WebView2 installer found. An evergreen installer will not be used as a fallback.');
  record('WebView2', webview);
  return { vs, webview };
}
async function linuxPlan() {
  const os = Object.fromEntries((await readFile('/etc/os-release', 'utf8')).split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
  if (!['debian', 'ubuntu'].includes(os.ID) || !/^[a-z]+$/.test(os.VERSION_CODENAME || '')) throw new Error('Automatic native Linux setup requires Debian/Ubuntu. Use --frontend-only on other distributions.');
  const stamp = new Date(now - WEEK - 86400000).toISOString().slice(0, 10).replaceAll('-', '') + 'T000000Z';
  const base = os.ID === 'debian' ? `https://snapshot.debian.org/archive/debian/${stamp}/` : `https://snapshot.ubuntu.com/ubuntu/${stamp}/`;
  const suites = os.ID === 'debian' ? [os.VERSION_CODENAME] : [os.VERSION_CODENAME, `${os.VERSION_CODENAME}-updates`, `${os.VERSION_CODENAME}-security`];
  const codename = os.VERSION_CODENAME;
  // Current official archives are consulted only for development packages that must match a
  // library this machine already has. They are not used to select the snapshot closure.
  const hostSources = os.ID === 'debian'
    ? `deb [check-valid-until=no] https://deb.debian.org/debian ${codename} main\ndeb [check-valid-until=no] https://deb.debian.org/debian ${codename}-updates main\ndeb [check-valid-until=no] https://deb.debian.org/debian-security ${codename}-security main\n`
    : `deb [check-valid-until=no] https://archive.ubuntu.com/ubuntu/ ${codename} main universe\ndeb [check-valid-until=no] https://archive.ubuntu.com/ubuntu/ ${codename}-updates main universe\ndeb [check-valid-until=no] https://security.ubuntu.com/ubuntu/ ${codename}-security main universe\n`;
  return { stamp, sources: suites.map(s => `deb [check-valid-until=no] ${base} ${s} main${os.ID === 'ubuntu' ? ' universe' : ''}`).join('\n') + '\n', hostSources };
}
function dpkgCompare(installed, snapshot) {
  const greater = spawnSync('dpkg', ['--compare-versions', installed, 'gt', snapshot]);
  if (greater.error || greater.status === 2) throw new Error(`dpkg failed: ${greater.error?.message || greater.stderr?.toString() || installed}`);
  if (greater.status === 0) return 1;
  const equal = spawnSync('dpkg', ['--compare-versions', installed, 'eq', snapshot]);
  if (equal.error || equal.status === 2) throw new Error(`dpkg failed: ${equal.error?.message || equal.stderr?.toString() || installed}`);
  return equal.status === 0 ? 0 : -1;
}
function installedDebianPackages() {
  const text = run('dpkg-query', ['-W', '-f', '${Package}\t${Status}\t${Version}\n'], { stdio: 'pipe', env: { ...process.env, LC_ALL: 'C' } });
  const installed = new Map();
  for (const line of text.split('\n')) {
    const [name, status, version] = line.split('\t');
    if (name && status === 'install ok installed' && version) installed.set(name, version);
  }
  return installed;
}
function aptFailure(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.startsWith('E:') || line.includes('Depends:') || line.includes('Hängt ab von:') || line.startsWith('Remv '));
  return lines.slice(0, 8).join('; ') || 'unresolvable package conflict';
}
async function applePlan() {
  // Apple's signed packages have Product PostDate in the public software-update catalog.
  // softwareupdate --install alone cannot enforce release age.
  const hostVersion = run('/usr/bin/sw_vers', ['-productVersion'], { stdio: 'pipe' });
  const hostMajor = Number(hostVersion.split('.')[0]);
  const modern = hostMajor >= 26 ? Array.from({ length: hostMajor - 25 }, (_, i) => hostMajor - i).join('-') + '-' : '';
  const url = process.env.URINAMU_APPLE_CATALOG || `https://swscan.apple.com/content/catalogs/others/index-${modern}15-14-13-12-10.16-10.15-10.14-10.13-10.12-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz`;
  if (new URL(url).hostname !== 'swscan.apple.com') throw new Error('The Apple catalog must be hosted on swscan.apple.com');
  const bytes = await get(url), catalogFile = path.join(local, 'apple-catalog.plist');
  await writeFile(catalogFile, bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
  const catalog = parsePlist(await readFile(catalogFile, 'utf8'));
  const candidates = Object.entries(catalog.Products).filter(([, p]) => p.PostDate && eligible(p.PostDate, now) && Object.values(p.Distributions || {}).some(u => /commandlinetools/i.test(u)))
    .sort((a, b) => Date.parse(b[1].PostDate) - Date.parse(a[1].PostDate));
  // Some catalog revisions use opaque distribution URLs; inspect titles as fallback.
  if (!candidates.length) {
    for (const entry of Object.entries(catalog.Products)) {
      const p = entry[1];
      if (p.PostDate && eligible(p.PostDate, now) && p.Packages?.some(pkg => /CLTools|CommandLineTools/i.test(pkg.URL))) candidates.push(entry);
    }
    candidates.sort((a, b) => Date.parse(b[1].PostDate) - Date.parse(a[1].PostDate));
  }
  if (!candidates.length) throw new Error('No dated Apple Command Line Tools found in the catalog. Set URINAMU_APPLE_CATALOG to the appropriate official OS catalog.');
  for (const [id, p] of candidates) {
    const distributionUrl = p.Distributions.English || p.Distributions.en || Object.values(p.Distributions)[0];
    const distribution = (await get(distributionUrl.replace(/^http:/, 'https:'))).toString();
    const titleKey = distribution.match(/<title>([^<]+)<\/title>/)?.[1];
    const title = distribution.match(/"SU_TITLE"\s*=\s*"([^"]+)"/)?.[1] || titleKey;
    if (!title || !/Command Line Tools/i.test(title)) continue;
    const ranges = [...distribution.matchAll(/<os-version\s+([^>]+)\/>/g)];
    if (!ranges.some(([, attrs]) => {
      const min = attrs.match(/min="([^"]+)"/)?.[1], before = attrs.match(/before="([^"]+)"/)?.[1];
      return min && compare(hostVersion, min) >= 0 && (!before || compare(hostVersion, before) < 0);
    })) continue;
    const version = distribution.match(/<pkg-ref[^>]+id="CLTools_Executables"[^>]+version="([^"]+)"/)?.[1];
    if (!version) continue;
    record('Apple Command Line Tools', { version, published: p.PostDate, source: url, product: id });
    if (!p.Packages?.length || p.Packages.some(pkg => !pkg.Digest || !Number.isSafeInteger(pkg.Size) || pkg.Size < 28)) throw new Error('Missing Apple package checksums');
    return { title, version, packages: p.Packages };
  }
  throw new Error('Apple does not offer demonstrably mature Command Line Tools compatible with this macOS. A younger release will not be installed.');
}

console.log(`UriNamu setup: cutoff ${cutoff}; npm ${npm.version}, Node ${node.version}`);
try {
  await npmAudit();
  let system;
  if (!frontendOnly) {
    await rustPlan();
    system = windows ? await windowsPlan() : mac ? await applePlan() : await linuxPlan();
  }
  await saveJson('.setup/release-audit.json', report);
  await saveJson('.setup/plan.json', { ...report, system });
  if (planOnly) { console.log('Plan verified: .setup/plan.json. No tools or project dependencies were installed.'); process.exit(0); }

  // Install managed Node/npm without replacing a system-wide installation.
  const os = windows ? 'win' : mac ? 'darwin' : 'linux';
  const name = `node-v${node.version}-${os}-${process.arch}`;
  const nodeRoot = path.join(local, name), nodeBin = keepNode ? path.dirname(process.execPath) : windows ? nodeRoot : path.join(nodeRoot, 'bin');
  if (!keepNode && !(await exists(path.join(nodeBin, windows ? 'node.exe' : 'node')))) {
    const filename = `${name}.${windows ? 'zip' : 'tar.gz'}`;
    const archive = await checkedArchive(`https://nodejs.org/dist/v${node.version}/${filename}`, filename);
    if (windows) run('powershell.exe', ['-NoProfile', '-File', path.join(root, 'scripts/Expand-SetupArchive.ps1'), archive, local]);
    else run('tar', ['-xzf', archive, '-C', local]);
  }
  const nodeExe = keepNode ? process.execPath : path.join(nodeBin, windows ? 'node.exe' : 'node');
  process.env.PATH = `${nodeBin}${path.delimiter}${process.env.PATH}`;
  // Keep an existing newer npm intact, even when Node needs upgrading.
  const npmPrefix = path.join(local, `npm-${npm.version}`);
  let npmCli = installedNpm?.cli;
  let npxCli = npmCli && path.join(path.dirname(npmCli), 'npx-cli.js');
  const npmBin = path.join(local, 'bin');
  if (!keepNpm) {
    const meta = npmMetadata.versions[npm.version];
    const integrity = meta.dist.integrity?.match(/^sha512-(\S+)$/)?.[1];
    if (!integrity) throw new Error('Missing npm SHA-512 metadata');
    const archive = await download(meta.dist.tarball, `npm-${npm.version}.tgz`, Buffer.from(integrity, 'base64').toString('hex'), 'sha512');
    // npm tarballs bundle their dependencies; extract to a private prefix without executing another npm.
    const moduleRoot = path.join(npmPrefix, windows ? 'node_modules/npm' : 'lib/node_modules/npm');
    await mkdir(moduleRoot, { recursive: true });
    run('tar', ['-xzf', archive, '-C', moduleRoot, '--strip-components=1']);
    npmCli = path.join(moduleRoot, 'bin/npm-cli.js');
    npxCli = path.join(moduleRoot, 'bin/npx-cli.js');
  }
  if (!npmCli) throw new Error('npm CLI not found');
  // Separate shims ensure that preserving npm never puts an older Node ahead in PATH.
  await mkdir(npmBin, { recursive: true });
  for (const [command, cli] of [['npm', npmCli], ['npx', npxCli]]) {
    if (windows) {
      // Percent expansion is active in .cmd files even inside quotes.
      const escape = s => s.replaceAll('%', '%%');
      await writeFile(path.join(npmBin, `${command}.cmd`), `@echo off\r\n"${escape(nodeExe)}" "${escape(cli)}" %*\r\n`);
    } else {
      const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
      const file = path.join(npmBin, command); await writeFile(file, `#!/bin/sh\nexec ${quote(nodeExe)} ${quote(cli)} "$@"\n`); await chmod(file, 0o755);
    }
  }
  process.env.PATH = `${npmBin}${path.delimiter}${process.env.PATH}`;
  const npmRun = argv => run(nodeExe, [npmCli, ...argv]);
  await saveJson('.setup/active-tools.json', { nodeExe, npmCli, node: effectiveNode, npm: keepNpm ? installedNpm.version : npm.version });

  if (!frontendOnly) {
    if (windows) {
      const vsFile = path.join(local, 'vs_BuildTools.exe');
      // Microsoft's fixed-version URL includes the bootstrapper's SHA-256.
      const vsHash = new URL(system.vs.url).pathname.split('/').at(-2);
      await download(system.vs.url, 'vs_BuildTools.exe', vsHash);
      const installScript = path.join(root, 'scripts/Install-WindowsNative.ps1');
      const webFile = await download(system.webview.url, 'WebView2Setup.exe', system.webview.hash);
      run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installScript, '-BuildTools', vsFile, '-WebView', webFile, '-ExpectedBuild', system.vs.build, '-ExpectedWebView', system.webview.version]);
      const native = JSON.parse((await readFile(path.join(local, 'native-env.json'), 'utf8')).replace(/^\uFEFF/, ''));
      for (const [key, value] of Object.entries(native)) process.env[key.toUpperCase() === 'PATH' ? 'PATH' : key] = value;
    } else if (mac) {
      const files = [];
      for (let i = 0; i < system.packages.length; i++) {
        const pkg = system.packages[i];
        const raw = String(pkg.Digest);
        const hash = (/^[a-f\d]{40}$|^[a-f\d]{64}$/i.test(raw) ? raw : Buffer.from(raw.replace(/\s/g, ''), 'base64').toString('hex')).toLowerCase();
        if (!/^[a-f\d]{40}$|^[a-f\d]{64}$/.test(hash)) throw new Error(`Unsupported Apple package checksum: apple-clt-${i}.pkg`);
        // Catalog Digest is the xar TOC checksum. Hashing the whole .pkg rejects intact Apple packages.
        const file = await download(pkg.URL.replace(/^http:/, 'https:'), `apple-clt-${i}.pkg`, hash, 'sha1', target => verifyApplePackage(target, hash, pkg.Size, `apple-clt-${i}.pkg`));
        run('/usr/sbin/pkgutil', ['--check-signature', file]);
        files.push(file);
      }
      // Packages replace only Command Line Tools, never a full Xcode installation.
      for (const file of files) {
        run('sudo', ['/usr/sbin/installer', '-pkg', file, '-target', '/']);
      }
      run('sudo', ['/usr/bin/xcode-select', '--switch', '/Library/Developer/CommandLineTools']);
      const installed = run('/usr/sbin/pkgutil', ['--pkg-info', 'com.apple.pkg.CLTools_Executables'], { stdio: 'pipe' });
      if (installed.match(/^version: (.+)$/m)?.[1] !== system.version) throw new Error('Installed Apple tools do not match the dated package versions.');
      run('/usr/bin/xcrun', ['--find', 'clang']);
    } else {
      const apt = path.join(local, 'apt');
      // The unprivileged _apt user cannot traverse a private home directory (mode 750).
      // Lists therefore live under the world-searchable temp directory.
      const lists = path.join(nodeOs.tmpdir(), `urinamu-apt-${nodeOs.userInfo().uid}`, 'lists');
      await mkdir(path.join(lists, 'partial'), { recursive: true });
      for (const directory of [path.dirname(lists), lists, path.join(lists, 'partial')]) await chmod(directory, 0o755);
      const snapshotList = path.join(apt, 'snapshot.list'), combinedList = path.join(apt, 'combined.list');
      await writeFile(snapshotList, system.sources);
      await writeFile(combinedList, system.sources + system.hostSources);
      const aptOptions = list => ['-o', `Dir::Etc::sourcelist=${list}`, '-o', 'Dir::Etc::sourceparts=-', '-o', `Dir::State::lists=${lists}`];
      const snapshotOptions = aptOptions(snapshotList), combinedOptions = aptOptions(combinedList);
      run('sudo', ['LC_ALL=C', 'apt-get', ...combinedOptions, 'update']);
      const names = ['build-essential', 'curl', 'ca-certificates', 'pkg-config', 'libwebkit2gtk-4.1-dev', 'libgtk-3-dev', 'libayatana-appindicator3-dev', 'librsvg2-dev', 'libxdo-dev', 'libssl-dev', 'patchelf', 'file'];
      // Resolve against an empty installed-state file and the snapshot only. Otherwise apt keeps
      // whichever newer packages happen to be installed and the closure is no longer reproducible.
      const simulation = run('sudo', ['LC_ALL=C', 'apt-get', ...snapshotOptions, '-o', 'Dir::State::status=/dev/null', '-s', 'install', '--no-install-recommends', ...names], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
      const resolvedPins = [...simulation.matchAll(/^Inst (\S+) \((\S+)/gm)].map(match => ({ name: match[1], version: match[2] }));
      if (!resolvedPins.length) throw new Error('Snapshot dependency resolution returned no versions');
      const { install, keep } = partitionSnapshotPins(resolvedPins, installedDebianPackages(), dpkgCompare);
      let request = install, solved = request.length === 0;
      for (let round = 0; !solved && round < 5; round++) {
        const probed = spawnSync('sudo', ['LC_ALL=C', 'apt-get', ...combinedOptions, '-s', 'install', '--no-remove', '--no-install-recommends', ...request.map(item => `${item.name}=${item.version}`)], { cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        const probedText = `${probed.stdout || ''}\n${probed.stderr || ''}`;
        if (probed.error) throw new Error(`apt-get failed: ${probed.error.message}`);
        const keptDowngrades = [...probedText.matchAll(/^Inst (\S+) \[/gm)].map(match => match[1]).filter(name => keep.some(item => item.name === name));
        if (probed.status === 0 && !/^Remv /m.test(probedText) && !keptDowngrades.length) { solved = true; break; }
        if (keptDowngrades.length && !parseExactDependencyConflicts(probedText).length) throw new Error(`Refusing to downgrade installed libraries: ${[...new Set(keptDowngrades)].join(', ')}`);
        const conflicts = parseExactDependencyConflicts(probedText);
        const conflictPackages = [...new Set(conflicts.map(conflict => conflict.package))];
        if (!conflictPackages.length) throw new Error(`The snapshot packages cannot be installed without removing unrelated packages: ${aptFailure(probedText)}`);
        const shown = run('sudo', ['LC_ALL=C', 'apt-cache', ...combinedOptions, 'show', ...conflictPackages], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
        const recordsByPackage = new Map();
        for (const record of parsePackageRecords(shown)) {
          const list = recordsByPackage.get(record.name) ?? [];
          list.push(record);
          recordsByPackage.set(record.name, list);
        }
        const applied = applyCompanionPins(request, conflicts, recordsByPackage, keep);
        if (!applied.changed) throw new Error(`The snapshot packages cannot be installed without downgrading installed libraries: ${aptFailure(probedText)}`);
        const companions = applied.install.filter(item => item.companionOf).map(item => `${item.name} ${item.version} (matches installed ${item.companionOf})`);
        console.log(`Keeping newer installed libraries. Matching development packages: ${companions.join(', ')}`);
        request = applied.install;
      }
      if (!solved) throw new Error('The snapshot packages cannot be installed without removing unrelated packages.');
      await saveJson('.setup/linux-packages.json', {
        snapshot: system.stamp,
        pins: request.map(item => `${item.name}=${item.version}`),
        kept: keep,
        companions: request.filter(item => item.companionOf).map(({ name, version, companionOf }) => ({ name, version, companionOf })),
      });
      // Never downgrade a newer installed library and never remove unrelated packages.
      if (request.length) run('sudo', ['LC_ALL=C', 'apt-get', ...combinedOptions, 'install', '-y', '--no-remove', '--no-install-recommends', ...request.map(item => `${item.name}=${item.version}`)]);
      run('pkg-config', ['--exists', 'gtk+-3.0', 'webkit2gtk-4.1']);
    }
    const host = `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-${windows ? 'pc-windows-msvc' : mac ? 'apple-darwin' : 'unknown-linux-gnu'}`;
    const filename = windows ? 'rustup-init.exe' : 'rustup-init';
    const url = `https://static.rust-lang.org/rustup/archive/${policy.rustup}/${host}/${filename}`;
    const hash = (await get(url + '.sha256')).toString().trim().split(/\s+/)[0];
    const installer = await download(url, filename, hash); if (!windows) await chmod(installer, 0o755);
    process.env.CARGO_HOME = path.join(local, 'cargo'); process.env.RUSTUP_HOME = path.join(local, 'rustup');
    process.env.RUSTUP_INIT_SKIP_PATH_CHECK = 'yes';
    run(installer, ['-y', '--no-modify-path', '--profile', 'minimal', '--default-host', host, '--default-toolchain', policy.rust]);
    const cargoBin = path.join(process.env.CARGO_HOME, 'bin');
    process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`;
    run(path.join(cargoBin, windows ? 'rustup.exe' : 'rustup'), ['set', 'auto-self-update', 'disable']);
    run(path.join(cargoBin, windows ? 'rustup.exe' : 'rustup'), ['component', 'add', 'rustfmt', '--toolchain', policy.rust]);
    run(path.join(cargoBin, windows ? 'cargo.exe' : 'cargo'), ['fetch', '--locked', '--manifest-path', 'src-tauri/Cargo.toml']);
  }

  // Setup changes only ignored local state, never tracked manifests or locks.
  const paths = [...new Set([npmBin, nodeBin, ...(!frontendOnly ? [path.join(local, 'cargo/bin')] : [])])];
  const psQuote = value => "'" + value.replaceAll("'", "''") + "'";
  const shQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const nativeActivation = windows && !frontendOnly ? `$native = Get-Content -LiteralPath ${psQuote(path.join(local, 'native-env.json'))} -Raw | ConvertFrom-Json\n$native.psobject.Properties | ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name, $_.Value, 'Process') }\n` : '';
  // Windows PowerShell 5.1 requires a BOM to read UTF-8 paths reliably.
  await writeFile(path.join(local, 'env.ps1'), '\uFEFF' + nativeActivation + `$env:Path = ${psQuote(paths.join(';') + ';')} + $env:Path\n` + (!frontendOnly ? `$env:CARGO_HOME = ${psQuote(process.env.CARGO_HOME)}\n$env:RUSTUP_HOME = ${psQuote(process.env.RUSTUP_HOME)}\n` : ''));
  await writeFile(path.join(local, 'env.sh'), `export PATH=${shQuote(paths.join(':'))}:"$PATH"\n` + (!frontendOnly ? `export CARGO_HOME=${shQuote(process.env.CARGO_HOME)}\nexport RUSTUP_HOME=${shQuote(process.env.RUSTUP_HOME)}\n` : ''));
  npmRun(['ci']);
  console.log('Setup complete. Activate the environment, then run npm run desktop (or npm run dev for --frontend-only).');
} catch (error) {
  await saveJson('.setup/release-audit.json', { ...report, error: error.message });
  console.error(`Setup aborted: ${error.message}`); process.exitCode = 1;
}
