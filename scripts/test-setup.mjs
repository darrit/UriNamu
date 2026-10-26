import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { WEEK, eligible, mature, latest, keepInstalled, satisfies, verify, verifyApplePackage, visualStudioReleases, parsePlist, partitionSnapshotPins, parseExactDependencyConflicts, parsePackageRecords, applyCompanionPins } from './setup-lib.mjs';

const now = Date.parse('2026-10-25T12:00:00Z');
async function nativeFixture(batch, assertion, body) {
  const base = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(base, 'urinamu-msvc-test-'));
  try {
    const installation = path.join(directory, 'Build Tools (test)');
    await mkdir(path.join(installation, 'Common7/Tools'), { recursive: true });
    await writeFile(path.join(installation, 'Common7/Tools/VsDevCmd.bat'), batch);
    const quote = s => "'" + s.replaceAll("'", "''") + "'";
    const helper = fileURLToPath(new URL('./windows-native-tools.ps1', import.meta.url));
    const action = body ? body(quote(path.join(installation, 'Common7/Tools/VsDevCmd.bat'))) : `$result=Get-UriNamuMsvcEnvironment -InstallationPath ${quote(installation)}; $result | ConvertTo-Json -Compress`;
    const code = `$ErrorActionPreference='Stop'; . ${quote(helper)}; ${action}`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { encoding: 'utf8' });
    assertion(result);
  } finally {
    // Remove only the exact temporary fixture created above, inside the OS temp folder.
    if (path.dirname(directory) !== base || !path.basename(directory).startsWith('urinamu-msvc-test-')) throw new Error('Invalid test directory');
    await rm(directory, { recursive: true, force: true });
  }
}
test('Windows MSVC activation preserves paths with spaces and parentheses under PowerShell 5.1', { skip: process.platform !== 'win32' }, async () => {
  await nativeFixture('@echo off\r\nset "INCLUDE=test include"\r\nset "LIB=test lib"\r\nset "VCToolsInstallDir=test compiler"\r\nset "WindowsSdkDir=test sdk"\r\nset "VCToolsVersion=14.44.35207"\r\nexit /b 0\r\n', result => {
    assert.equal(result.status, 0, result.stderr);
    const values = JSON.parse(result.stdout.trim());
    assert.equal(values.INCLUDE, 'test include'); assert.equal(values.VCToolsVersion, '14.44.35207');
  });
});
test('Windows PowerShell 5.1 enumerates vswhere instances before matching installed versions', { skip: process.platform !== 'win32' }, async () => {
  await nativeFixture('@echo off\r\necho [{"installationVersion":"17.14.1.0"},{"installationVersion":"17.14.2.0"}]\r\nexit /b 0\r\n', result => {
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { count: 2, matches: 1 });
  }, file => `$instances=@(Get-UriNamuBuildTools -VsWhere ${file}); @{count=$instances.Count;matches=@($instances | Where-Object installationVersion -eq '17.14.1.0').Count} | ConvertTo-Json -Compress`);
});
test('Windows MSVC activation propagates a failing batch exit code', { skip: process.platform !== 'win32' }, async () => {
  await nativeFixture('@echo off\r\nexit /b 7\r\n', result => {
    assert.notEqual(result.status, 0); assert.match(result.stderr, /exit code 7/);
  });
});
test('Windows elevation is required only for missing build tools or changed machine runtime', { skip: process.platform !== 'win32' }, () => {
  const helper = fileURLToPath(new URL('./windows-native-tools.ps1', import.meta.url)).replaceAll("'", "''");
  const code = `$ErrorActionPreference='Stop'; . '${helper}'; $cases=@(
    (Test-UriNamuNeedsElevation -ExpectedBuild '17.14.1.0' -ExpectedWebView '155.0.1.0' -InstalledBuildVersions @('17.14.1.0') -MachineWebViewVersions @('155.0.1.0')),
    (Test-UriNamuNeedsElevation -ExpectedBuild '17.14.1.0' -ExpectedWebView '155.0.1.0' -InstalledBuildVersions @() -MachineWebViewVersions @('155.0.1.0')),
    (Test-UriNamuNeedsElevation -ExpectedBuild '17.14.1.0' -ExpectedWebView '155.0.1.0' -InstalledBuildVersions @('17.14.1.0') -MachineWebViewVersions @('156.0.1.0')),
    (Test-UriNamuNeedsElevation -ExpectedBuild '17.14.1.0' -ExpectedWebView '155.0.1.0' -InstalledBuildVersions @('17.14.1.0') -MachineWebViewVersions @())
  ); ConvertTo-Json -InputObject $cases -Compress`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [false, true, true, false]);
});
test('strict seven-day boundary and conservative date-only releases', () => {
  assert.equal(eligible(new Date(now - WEEK).toISOString(), now), false);
  assert.equal(eligible(new Date(now - WEEK - 1).toISOString(), now), true);
  assert.equal(eligible('2026-10-18', now), false);
  assert.equal(eligible('2026-10-17', now), true);
  assert.throws(() => mature(undefined, now));
  assert.throws(() => mature('not-a-date', now));
});
test('newer and equal installed Node/npm stay untouched, independently', () => {
  for (const version of ['24.22.0', '24.22.1', '26.1.0']) assert.equal(keepInstalled(version, '24.22.0'), true);
  assert.equal(keepInstalled('24.21.9', '24.22.0'), false);
  assert.equal(keepInstalled(undefined, '12.2.1'), false);
  assert.equal(keepInstalled('12.3.0', '12.2.1'), true);
  assert.equal(keepInstalled('24.22.1-rc.1', '24.22.0'), false);
});
test('selection excludes young, prerelease and different major releases', () => {
  const rows = [
    { version: '24.22.0', published: '2026-10-14' },
    { version: '24.22.1', published: '2026-10-20' },
    { version: '24.23.0-rc.1', published: '2026-10-01' },
    { version: '26.1.0', published: '2026-10-01' },
  ];
  assert.equal(latest(rows, 24, now).version, '24.22.0');
  assert.throws(() => latest(rows, 22, now));
});
test('npm engine compatibility and unknown syntax fail closed', () => {
  assert.equal(satisfies('24.22.0', '^20.17.0 || >=22.9.0'), true);
  assert.equal(satisfies('22.8.0', '^20.17.0 || >=22.9.0'), false);
  assert.equal(satisfies('26.0.0', '>=24.0.0 <27.0.0'), true);
  assert.equal(satisfies('24.0.0', 'unknown'), false);
});
test('Microsoft parser excludes evergreen table and uses fixed Current releases', () => {
  const row = (channel, version, url) => `<tr><td>${channel}</td><td>${version}</td><td>October 13, 2026</td><td><a href="${url}">Build Tools</a></td><td>17.14.37806.7</td></tr>`;
  const url = 'https://download.visualstudio.microsoft.com/download/pr/test/abc/vs_BuildTools.exe';
  const html = '<table>' + row('Current', '99.0.0', url) + '</table><h3 id="fixed-version-bootstrappers">Fixed</h3><table>' + row('Current', '17.14.42', url) + row('LTSC', '17.12.22', url) + '</table>';
  const releases = visualStudioReleases(html);
  assert.equal(releases.length, 1); assert.equal(releases[0].version, '17.14.42');
  assert.equal(releases[0].published, '2026-10-13');
  assert.throws(() => visualStudioReleases('<table></table>'));
});
test('hash mismatch never passes', () => {
  verify(Buffer.from('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.throws(() => verify(Buffer.from('tampered'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
  assert.throws(() => verify(Buffer.from('abc'), undefined));
});
test('Apple plist dates, binary digests, arrays and XML entities survive parsing', () => {
  const p = parsePlist('<?xml version="1.0"?><!DOCTYPE plist PUBLIC "test"><plist version="1.0"><dict><key>PostDate</key><date>2026-10-14T12:00:00Z</date><key>Packages</key><array><dict><key>Digest</key><data>YWJj</data><key>URL</key><string>https://apple.com/a?x=1&amp;y=2</string><key>Size</key><integer>42</integer></dict></array><key>Empty</key><string/></dict></plist>');
  assert.equal(p.PostDate, '2026-10-14T12:00:00Z');
  assert.equal(p.Packages[0].Digest, 'YWJj'); assert.equal(p.Packages[0].Size, 42);
  assert.equal(p.Packages[0].URL, 'https://apple.com/a?x=1&y=2'); assert.equal(p.Empty, '');
  assert.throws(() => parsePlist('<plist><dict><key>oops</key></plist>'));
});
function applePackage(payload, extractedSize = payload.length + 10) {
  const archived = createHash('sha1').update(payload).digest('hex');
  const tocXml = `<?xml version="1.0"?><xar><toc><checksum style="sha1"><offset>0</offset><size>20</size></checksum><file id="1"><data><length>${payload.length}</length><offset>20</offset><size>${extractedSize}</size><archived-checksum style="sha1">${archived}</archived-checksum></data><name>Payload</name></file></toc></xar>`;
  const toc = deflateSync(Buffer.from(tocXml));
  const digest = createHash('sha1').update(toc).digest();
  const header = Buffer.alloc(28);
  header.write('xar!', 0, 'latin1');
  header.writeUInt16BE(28, 4);
  header.writeUInt16BE(1, 6);
  header.writeBigUInt64BE(BigInt(toc.length), 8);
  header.writeBigUInt64BE(BigInt(Buffer.byteLength(tocXml)), 16);
  header.writeUInt32BE(1, 24);
  return { bytes: Buffer.concat([header, toc, digest, payload]), digest: digest.toString('hex') };
}
test('Linux snapshot pins keep newer installed libraries and retarget exact development dependencies', () => {
  const rank = { '1.0': 1, '2.0': 2, '1.2.0-3build1': 3, '1.2.0-3ubuntu0.1': 4 };
  const compareVersions = (left, right) => left === right ? 0 : rank[left] - rank[right];
  const { install, keep } = partitionSnapshotPins([
    { name: 'libbrotli1', version: '1.2.0-3build1' },
    { name: 'libbrotli-dev', version: '1.2.0-3build1' },
    { name: 'make', version: '4.4.1-3' },
    { name: 'zlib1g', version: '2.0' },
    { name: 'curl', version: '8.0' },
  ], new Map([['libbrotli1', '1.2.0-3ubuntu0.1'], ['zlib1g', '1.0'], ['curl', '8.0']]), compareVersions);
  assert.deepEqual(keep, [{ name: 'libbrotli1', installed: '1.2.0-3ubuntu0.1', snapshot: '1.2.0-3build1' }]);
  assert.deepEqual(install.map(item => `${item.name}=${item.version}`), ['libbrotli-dev=1.2.0-3build1', 'make=4.4.1-3', 'zlib1g=2.0']);
  const conflicts = parseExactDependencyConflicts(' libbrotli-dev : Depends: libbrotli1 (= 1.2.0-3build1) but 1.2.0-3ubuntu0.1 is to be installed\n libbrotli-dev : Hängt ab von: libbrotli1 (= 1.2.0-3build1) aber 1.2.0-3ubuntu0.1 soll installiert werden\n');
  assert.equal(conflicts.length, 2);
  const records = parsePackageRecords('Package: libbrotli-dev\nVersion: 1.2.0-3build1\nDepends: libbrotli1 (= 1.2.0-3build1)\n\nPackage: libbrotli-dev\nVersion: 1.2.0-3ubuntu0.1\nDepends: libbrotli1 (= 1.2.0-3ubuntu0.1)\n\nIncomplete\n');
  const applied = applyCompanionPins(install, conflicts.slice(0, 1), new Map([['libbrotli-dev', records]]), keep);
  assert.equal(applied.changed, true);
  assert.equal(applied.install.find(item => item.name === 'libbrotli-dev').version, '1.2.0-3ubuntu0.1');
  assert.equal(applyCompanionPins(install, [{ package: 'libbrotli-dev', dependency: 'libbrotli1', required: '1.2.0-3build1', actual: '9.9' }], new Map([['libbrotli-dev', records]]), keep).changed, false);
});
test('Apple catalog digest verifies the xar TOC, not the whole package', async () => {
  const payload = Buffer.from('command-line-tools');
  const { bytes, digest } = applePackage(payload);
  const whole = createHash('sha1').update(bytes).digest('hex');
  assert.notEqual(whole, digest);
  const directory = await mkdtemp(path.join(path.resolve(tmpdir()), 'urinamu-apple-pkg-'));
  const file = path.join(directory, 'apple-clt-0.pkg');
  try {
    await writeFile(file, bytes);
    await verifyApplePackage(file, digest, bytes.length, 'apple-clt-0.pkg');
    bytes[bytes.length - 1] ^= 0xff;
    await writeFile(file, bytes);
    await assert.rejects(() => verifyApplePackage(file, digest, bytes.length, 'apple-clt-0.pkg'), /archived-checksum mismatch: apple-clt-0\.pkg/);
    const intact = applePackage(payload);
    await writeFile(file, intact.bytes);
    await assert.rejects(() => verifyApplePackage(file, 'a'.repeat(40), intact.bytes.length, 'apple-clt-0.pkg'), /sha1-checksum mismatch: apple-clt-0\.pkg/);
    await assert.rejects(() => verifyApplePackage(file, intact.digest, intact.bytes.length + 1, 'apple-clt-0.pkg'), /Apple package size mismatch: apple-clt-0\.pkg/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
