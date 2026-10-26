import {
  readFileSync,
  writeFileSync,
  accessSync,
  constants,
  renameSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const files = [
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
];
export function nextVersion(current, change) {
  if (!/^\d+\.\d+\.\d+$/.test(current))
    throw Error(`Invalid application version: ${current}`);
  const values = current.split(".").map(Number);
  if (!values.every(Number.isSafeInteger))
    throw Error("Application version exceeds the supported numeric range.");
  const index = ["major", "minor", "patch"].indexOf(change);
  if (index < 0) throw Error("Choose patch, minor or major.");
  values[index]++;
  for (let i = index + 1; i < 3; i++) values[i] = 0;
  if (!values.every(Number.isSafeInteger))
    throw Error("Application version exceeds the supported numeric range.");
  return values.join(".");
}
function manifestSection(source) {
  const section = source.split(/^\[package\]\s*$/m)[1]?.split(/^\[/m)[0];
  if (!section) throw Error("Cargo.toml has no [package] section.");
  return section;
}
function crateSection(source, name) {
  const sections = source
    .split(/^\[\[package\]\]\s*$/m)
    .slice(1)
    .filter((section) => section.match(/^name\s*=\s*"([^"]+)"/m)?.[1] === name);
  if (sections.length !== 1)
    throw Error(
      `Cargo.lock must contain exactly one application package named ${name}.`,
    );
  return sections[0];
}
function versionFrom(section) {
  const version = section.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!version) throw Error("Missing Cargo application version.");
  return version;
}
export function checkVersions(root, allowMismatch = false) {
  const source = new Map(
    files.map((file) => [file, readFileSync(path.join(root, file), "utf8")]),
  );
  const pkg = JSON.parse(source.get("package.json"));
  const lock = JSON.parse(source.get("package-lock.json"));
  const tauri = JSON.parse(source.get("src-tauri/tauri.conf.json"));
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version))
    throw Error(
      "Application version must be a stable major.minor.patch version.",
    );
  const versions = {
    "package.json": pkg.version,
    "package-lock.json": lock.version,
    "package-lock.json root package": lock.packages?.[""]?.version,
    "tauri.conf.json": tauri.version,
    "Cargo.toml": versionFrom(
      manifestSection(source.get("src-tauri/Cargo.toml")),
    ),
    "Cargo.lock": versionFrom(
      crateSection(source.get("src-tauri/Cargo.lock"), pkg.name),
    ),
  };
  const mismatches = Object.entries(versions).filter(
    ([, value]) => value !== pkg.version,
  );
  if (mismatches.length && !allowMismatch)
    throw Error(
      `Application versions disagree with package.json (${pkg.version}): ${mismatches.map(([name, value]) => `${name}=${value}`).join(", ")}. Use npm run version:sync to restore the package.json version.`,
    );
  return { version: pkg.version, pkg, lock, tauri, source };
}
export function bumpVersion(root, change) {
  const state = checkVersions(root);
  const version = nextVersion(state.version, change);
  return writeVersion(root, state, version);
}
export function syncVersion(root) {
  const state = checkVersions(root, true);
  return writeVersion(root, state, state.version);
}
function atomicWrite(file, content) {
  const temp = path.join(
    path.dirname(file),
    `.urinamu-version-${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temp, content, { flag: "wx" });
    for (let attempt = 0; ; attempt++) {
      try {
        renameSync(temp, file);
        break;
      } catch (error) {
        if (
          attempt >= 9 ||
          !["EPERM", "EACCES", "EBUSY", "UNKNOWN"].includes(error.code)
        )
          throw error;
        // Antivirus and readers can briefly hold Windows file handles.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
    }
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}
function writeVersion(root, state, version) {
  state.pkg.version =
    state.lock.version =
    state.lock.packages[""].version =
    state.tauri.version =
      version;
  const updated = new Map([
    ["package.json", JSON.stringify(state.pkg, null, 2) + "\n"],
    ["package-lock.json", JSON.stringify(state.lock, null, 2) + "\n"],
    ["src-tauri/tauri.conf.json", JSON.stringify(state.tauri, null, 2) + "\n"],
  ]);
  for (const [file, section] of [
    [
      "src-tauri/Cargo.toml",
      manifestSection(state.source.get("src-tauri/Cargo.toml")),
    ],
    [
      "src-tauri/Cargo.lock",
      crateSection(state.source.get("src-tauri/Cargo.lock"), state.pkg.name),
    ],
  ])
    updated.set(
      file,
      state.source.get(file).replace(
        section,
        section.replace(
          /^(version\s*=\s*")[^"]+(".*)$/m,
          (_, start, end) => start + version + end,
        ),
      ),
    );
  // Validate every target before making changes, and restore originals on a write error.
  for (const file of files) accessSync(path.join(root, file), constants.W_OK);
  const written = [];
  try {
    for (const [file, content] of updated) {
      atomicWrite(path.join(root, file), content);
      written.push(file);
    }
    checkVersions(root);
  } catch (error) {
    const rollbackErrors = [];
    for (const file of written) {
      try {
        atomicWrite(path.join(root, file), state.source.get(file));
      } catch (rollbackError) {
        rollbackErrors.push(`${file}: ${rollbackError.message}`);
      }
    }
    throw Error(
      `Could not update application versions: ${error.message}${rollbackErrors.length ? `. Could not restore: ${rollbackErrors.join("; ")}. Run npm run version:sync to recover.` : ". Original versions restored."}`,
    );
  }
  return { previous: state.version, version };
}
const appChange = /^(src\/|src-tauri\/src\/|src-tauri\/build\.rs$|tests\/)/;
export function needsAutomaticBump(headVersion, workVersion, paths) {
  const changed = paths.some((file) =>
    appChange.test(String(file).replaceAll("\\", "/")),
  );
  return changed && headVersion === workVersion;
}
export function parseGitStatus(raw) {
  const parts = String(raw).split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < parts.length; index++) {
    const status = parts[index].slice(0, 2);
    paths.push(parts[index].slice(3));
    if (status.startsWith("R") || status.startsWith("C")) paths.push(parts[++index]);
  }
  return paths.filter(Boolean);
}
