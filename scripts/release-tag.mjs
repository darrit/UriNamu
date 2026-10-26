import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rules = [
  { kind: "Windows installer", test: (name) => name.endsWith("-setup.exe") },
  { kind: "Debian package", test: (name) => name.endsWith(".deb") },
  { kind: "AppImage", test: (name) => name.endsWith(".AppImage") },
  { kind: "macOS disk image", test: (name) => name.endsWith(".dmg") },
];

export function assertReleaseTag(tag, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`) {
    throw new Error(
      `Tag ${tag} does not match application version v${version}. Push a tag named v${version}.`,
    );
  }
}

export function changelogEntry(markdown, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid version: ${version}`);
  const lines = String(markdown).split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line === `## ${version}` || line.startsWith(`## ${version} `),
  );
  if (start < 0) throw new Error(`CHANGELOG has no entry for ${version}`);
  let end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join("\n").trim() + "\n";
}

export function releaseNotes(markdown, version) {
  return (
    changelogEntry(markdown, version) +
    "\nThe macOS disk image from this workflow is not signed or notarized. The Windows installer installs the WebView2 runtime when it is missing; that download needs an internet connection.\n"
  );
}

export function collectReleaseFiles(sourceDir, destDir) {
  const source = path.resolve(sourceDir);
  const dest = path.resolve(destDir);
  mkdirSync(dest, { recursive: true });
  const found = new Map(rules.map((rule) => [rule.kind, []]));
  for (const file of walk(source, dest)) {
    const rule = rules.find((item) => item.test(path.basename(file)));
    if (rule) found.get(rule.kind).push(file);
  }
  const missing = [...found.entries()]
    .filter(([, list]) => list.length === 0)
    .map(([kind]) => kind);
  if (missing.length) throw new Error(`Missing release files: ${missing.join(", ")}`);
  const copied = [];
  const names = new Set();
  for (const list of found.values()) {
    for (const file of list) {
      const name = path.basename(file);
      if (names.has(name)) throw new Error(`Duplicate release file name: ${name}`);
      names.add(name);
      const target = path.join(dest, name);
      copyFileSync(file, target);
      copied.push(target);
    }
  }
  return copied.sort();
}

function walk(directory, skip) {
  if (path.resolve(directory) === skip) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (path.resolve(full) === skip) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full, skip));
    else if (stat.isFile()) files.push(full);
  }
  return files;
}

function readVersion() {
  return JSON.parse(readFileSync("package.json", "utf8")).version;
}

function main() {
  const version = readVersion();
  const collectAt = process.argv.indexOf("--collect");
  if (process.argv.includes("--notes") && collectAt !== -1) {
    throw new Error("Use either --notes or --collect.");
  }
  if (process.argv.includes("--notes")) {
    assertReleaseTag(process.env.GITHUB_REF_NAME, version);
    process.stdout.write(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version));
    return;
  }
  if (collectAt !== -1) {
    const source = process.argv[collectAt + 1];
    const dest = process.argv[collectAt + 2];
    if (!source || !dest) {
      throw new Error("Usage: node scripts/release-tag.mjs --collect <source> <dest>");
    }
    const files = collectReleaseFiles(source, dest);
    console.log(files.map((file) => path.basename(file)).join("\n"));
    return;
  }
  assertReleaseTag(process.env.GITHUB_REF_NAME, version);
  console.log(`Release tag ${process.env.GITHUB_REF_NAME} matches application version ${version}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
