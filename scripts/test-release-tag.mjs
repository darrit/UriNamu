import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertReleaseTag, changelogEntry, collectReleaseFiles, releaseNotes } from "./release-tag.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const notes = "# Changelog\n\n## 0.4.46 — 2026-10-26\n\n- Current fix.\n\n## 0.4.45 — 2026-10-26\n\n- Older fix.\n";

test("a release tag must be v plus the committed application version", () => {
  assertReleaseTag("v0.4.46", "0.4.46");
  assert.throws(() => assertReleaseTag("0.4.46", "0.4.46"), /Push a tag named v0\.4\.46/);
  assert.throws(() => assertReleaseTag("v0.4.47", "0.4.46"), /does not match/);
  assert.throws(() => assertReleaseTag("v0.4.46-beta", "0.4.46-beta"), /does not match/);
});

test("release notes use only the matching changelog section", () => {
  assert.equal(changelogEntry(notes, "0.4.46"), "## 0.4.46 — 2026-10-26\n\n- Current fix.\n");
  assert.match(releaseNotes(notes, "0.4.46"), /Current fix/);
  assert.doesNotMatch(releaseNotes(notes, "0.4.46"), /Older fix/);
  assert.match(releaseNotes(notes, "0.4.46"), /not signed or notarized/);
  assert.match(releaseNotes(notes, "0.4.46"), /installs the WebView2 runtime when it is missing/);
  assert.doesNotMatch(releaseNotes(notes, "0.4.46"), /already installed/);
  assert.throws(() => changelogEntry(notes, "0.4.44"), /no entry/);
});

test("release files keep installers and require every platform", () => {
  const directory = mkdtempSync(path.join(path.resolve(tmpdir()), "urinamu-release-"));
  const source = path.join(directory, "artifacts");
  try {
    const bundle = path.join(source, "bundle", "nsis");
    mkdirSync(bundle, { recursive: true });
    mkdirSync(path.join(source, "bundle", "deb"), { recursive: true });
    mkdirSync(path.join(source, "bundle", "appimage"), { recursive: true });
    mkdirSync(path.join(source, "bundle", "dmg"), { recursive: true });
    mkdirSync(path.join(source, "bundle", "macos", "UriNamu.app"), { recursive: true });
    writeFileSync(path.join(bundle, "UriNamu_0.4.46_x64-setup.exe"), "exe");
    writeFileSync(path.join(source, "bundle", "deb", "urinamu_0.4.46_amd64.deb"), "deb");
    writeFileSync(path.join(source, "bundle", "appimage", "urinamu_0.4.46_amd64.AppImage"), "image");
    writeFileSync(path.join(source, "bundle", "dmg", "UriNamu_0.4.46_universal.dmg"), "dmg");
    writeFileSync(path.join(source, "bundle", "macos", "UriNamu.app", "binary"), "app");
    writeFileSync(path.join(source, "bundle", "note.txt"), "skip");
    const dest = path.join(directory, "release");
    const copied = collectReleaseFiles(source, dest).map((file) => path.basename(file));
    assert.deepEqual(copied, [
      "UriNamu_0.4.46_universal.dmg",
      "UriNamu_0.4.46_x64-setup.exe",
      "urinamu_0.4.46_amd64.AppImage",
      "urinamu_0.4.46_amd64.deb",
    ]);
    rmSync(path.join(source, "bundle", "dmg"), { recursive: true, force: true });
    assert.throws(() => collectReleaseFiles(source, path.join(directory, "missing")), /macOS disk image/);
    mkdirSync(path.join(source, "bundle", "dmg"), { recursive: true });
    writeFileSync(path.join(source, "bundle", "dmg", "UriNamu_0.4.46_universal.dmg"), "dmg");
    mkdirSync(path.join(source, "bundle", "nsis", "again"), { recursive: true });
    writeFileSync(path.join(source, "bundle", "nsis", "again", "UriNamu_0.4.46_x64-setup.exe"), "exe");
    assert.throws(() => collectReleaseFiles(source, path.join(directory, "other")), /Duplicate release file name/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the release command checks the tag from the environment", () => {
  const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  const command = path.join(root, "scripts", "release-tag.mjs");
  const match = spawnSync(process.execPath, [command], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GITHUB_REF_NAME: `v${version}` },
  });
  assert.equal(match.status, 0, match.stderr);
  assert.match(match.stdout, new RegExp(`v${version}`));
  const mismatch = spawnSync(process.execPath, [command], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GITHUB_REF_NAME: "v0.0.0" },
  });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match/);
});
