import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  nextVersion,
  checkVersions,
  bumpVersion,
  syncVersion,
  needsAutomaticBump,
  parseGitStatus,
} from "./version-lib.mjs";

function fixture(action) {
  const base = path.resolve(tmpdir());
  const root = mkdtempSync(path.join(base, "urinamu-version-test-"));
  mkdirSync(path.join(root, "src-tauri"));
  const json = (file, value) =>
    writeFileSync(path.join(root, file), JSON.stringify(value));
  json("package.json", {
    name: "urinamu",
    version: "0.2.1",
    dependencies: { example: "3.2.1" },
  });
  json("package-lock.json", {
    version: "0.2.1",
    packages: {
      "": { version: "0.2.1" },
      "node_modules/example": { version: "3.2.1" },
    },
  });
  json("src-tauri/tauri.conf.json", { version: "0.2.1" });
  writeFileSync(
    path.join(root, "src-tauri/Cargo.toml"),
    '[package]\nname = "urinamu"\nversion = "0.2.1"\n\n[dependencies]\nexample = { version = "=3.2.1" }\n',
  );
  writeFileSync(
    path.join(root, "src-tauri/Cargo.lock"),
    'version = 4\n\n[[package]]\nname = "example"\nversion = "3.2.1"\n\n[[package]]\nname = "urinamu"\nversion = "0.2.1"\n',
  );
  try {
    action(root);
  } finally {
    if (
      path.dirname(root) !== base ||
      !path.basename(root).startsWith("urinamu-version-test-")
    )
      throw Error("Invalid fixture path.");
    rmSync(root, { recursive: true, force: true });
  }
}
test("patch, minor and major changes reset lower version components", () => {
  assert.equal(nextVersion("0.2.1", "patch"), "0.2.2");
  assert.equal(nextVersion("0.2.1", "minor"), "0.3.0");
  assert.equal(nextVersion("0.2.1", "major"), "1.0.0");
  assert.throws(() => nextVersion("0.2.1", "latest"));
  assert.throws(() => nextVersion("0.2.1-rc.1", "patch"));
});
test("all application manifests/locks advance together without touching dependency versions", () =>
  fixture((root) => {
    assert.deepEqual(bumpVersion(root, "minor"), {
      previous: "0.2.1",
      version: "0.3.0",
    });
    const state = checkVersions(root);
    assert.equal(state.version, "0.3.0");
    assert.equal(state.pkg.dependencies.example, "3.2.1");
    assert.equal(state.lock.packages["node_modules/example"].version, "3.2.1");
    assert.match(
      state.source.get("src-tauri/Cargo.toml"),
      /version = "=3.2.1"/,
    );
    assert.match(
      state.source.get("src-tauri/Cargo.lock"),
      /name = "example"\nversion = "3.2.1"/,
    );
  }));
test("mismatched manifests are rejected before any file is changed", () =>
  fixture((root) => {
    const original = readFileSync(path.join(root, "package.json"), "utf8");
    writeFileSync(
      path.join(root, "src-tauri/tauri.conf.json"),
      '{"version":"0.1.0"}',
    );
    assert.throws(() => checkVersions(root), /disagree/);
    assert.throws(() => bumpVersion(root, "patch"), /disagree/);
    assert.equal(
      readFileSync(path.join(root, "package.json"), "utf8"),
      original,
    );
  }));
test("explicit sync repairs an interrupted update using package.json without another bump", () =>
  fixture((root) => {
    const file = path.join(root, "package.json");
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    pkg.version = "0.3.0";
    writeFileSync(file, JSON.stringify(pkg));
    assert.equal(syncVersion(root).version, "0.3.0");
    assert.equal(checkVersions(root).version, "0.3.0");
    assert.equal(
      checkVersions(root).lock.packages["node_modules/example"].version,
      "3.2.1",
    );
  }));
test("automatic bump runs once for unversioned application edits and skips docs or an existing bump", () => {
  assert.equal(
    needsAutomaticBump("0.4.11", "0.4.11", ["src/App.tsx"]),
    true,
  );
  assert.equal(
    needsAutomaticBump("0.4.11", "0.4.12", ["src/App.tsx"]),
    false,
  );
  assert.equal(
    needsAutomaticBump("0.4.11", "0.4.11", ["README.md", "docs/USER-GUIDE.md"]),
    false,
  );
  assert.deepEqual(
    parseGitStatus(" M src/App.tsx\0?? tests/new.test.ts\0R  old.tsx\0src/New.tsx\0"),
    ["src/App.tsx", "tests/new.test.ts", "old.tsx", "src/New.tsx"],
  );
});
