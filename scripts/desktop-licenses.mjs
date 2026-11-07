import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const supplements = JSON.parse(readFileSync("scripts/license-texts/packages.json", "utf8"));
const licenseName = /^(licen[cs]es?|copying|copyright|notice|unlicense)([._-]|$)/i;
const bundleTarget = process.env.TAURI_ENV_TARGET_TRIPLE ??
  execFileSync("rustc", ["-vV"], { encoding: "utf8" }).match(/^host: (.+)$/m)?.[1];
if (!bundleTarget) throw new Error("Could not determine the target for desktop license notices.");
const targets = bundleTarget === "universal-apple-darwin"
  ? ["x86_64-apple-darwin", "aarch64-apple-darwin"]
  : [bundleTarget];

const packages = new Map();
for (const target of targets) {
  const metadata = JSON.parse(execFileSync("cargo", [
    "metadata", "--locked", "--format-version", "1", "--manifest-path", "src-tauri/Cargo.toml",
    "--filter-platform", target,
  ], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
  const byId = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
  const pending = [metadata.resolve.root];
  const visited = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const pkg = byId.get(id);
    if (pkg.targets.every(({ kind }) => kind.includes("proc-macro"))) continue;
    if (pkg.source) packages.set(id, pkg);
    for (const dependency of nodes.get(id).deps) {
      if (dependency.dep_kinds.some(({ kind }) => kind === null)) pending.push(dependency.pkg);
    }
  }
}

const output = [
  "# Native third-party notices",
  "",
  `Cargo dependencies resolved for ${bundleTarget}. Third-party code retains its own license.`,
  "The links below provide the exact crate source, including source licensed under MPL 2.0.",
  "",
  "Bundled SQLite is in the public domain. See https://sqlite.org/copyright.html.",
  "The Rust standard library's terms and component notices are linked in this directory's README.",
];
const texts = new Map();
for (const pkg of [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))) {
  const directory = path.dirname(pkg.manifest_path);
  const files = readdirSync(directory, { withFileTypes: true }).filter((entry) => licenseName.test(entry.name));
  const paths = new Set(files.flatMap((entry) => entry.isDirectory()
    ? readdirSync(path.join(directory, entry.name), { withFileTypes: true })
      .filter((child) => child.isFile()).map((child) => path.join(directory, entry.name, child.name))
    : [path.join(directory, entry.name)]));
  if (pkg.license_file) paths.add(path.resolve(directory, pkg.license_file));
  const supplemental = supplements[`${pkg.name}@${pkg.version}`];
  for (const file of supplemental ?? []) paths.add(path.join("scripts/license-texts", file));
  if (!paths.size) throw new Error(`Missing upstream license text for ${pkg.name} ${pkg.version}.`);

  output.push("", `## ${pkg.name} ${pkg.version}`, "", `License: ${pkg.license ?? pkg.license_file}`);
  if (pkg.source !== "registry+https://github.com/rust-lang/crates.io-index") {
    throw new Error(`Unsupported source for ${pkg.name}: ${pkg.source}`);
  }
  const source = `https://static.crates.io/crates/${pkg.name}/${pkg.name}-${pkg.version}.crate`;
  output.push(`Source: ${source}`);
  for (const file of [...paths].sort()) {
    const content = readFileSync(file, "utf8").replaceAll("\r\n", "\n").trim();
    if (!content) throw new Error(`Empty license notice: ${file}`);
    if (!texts.has(content)) texts.set(content, texts.size + 1);
    output.push(`- ${path.basename(file)}: notice ${texts.get(content)}`);
  }
}
for (const [content, number] of texts) output.push("", `## Notice ${number}`, "", content);

const destination = "src-tauri/licenses";
mkdirSync(destination, { recursive: true });
copyFileSync("dist/THIRD-PARTY-WEB.md", path.join(destination, "THIRD-PARTY-WEB.md"));
writeFileSync(path.join(destination, "THIRD-PARTY-RUST.md"), `${output.join("\n")}\n`);
console.log(`Prepared desktop license notices for ${packages.size} Rust crates and bundled JavaScript.`);
