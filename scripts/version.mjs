import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkVersions,
  bumpVersion,
  syncVersion,
  needsAutomaticBump,
  parseGitStatus,
} from "./version-lib.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
function git(gitArgs) {
  return execFileSync("git", gitArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}
function automaticBump() {
  let headVersion;
  try {
    headVersion = JSON.parse(git(["show", "HEAD:package.json"])).version;
  } catch {
    console.log("Automatic version bump skipped: no git history.");
    return;
  }
  const paths = parseGitStatus(git(["status", "--porcelain", "-z"]));
  const workVersion = checkVersions(root).version;
  if (!needsAutomaticBump(headVersion, workVersion, paths)) {
    console.log(`Application version unchanged: ${workVersion}`);
    return;
  }
  const result = bumpVersion(root, "patch");
  const changelog = path.join(root, "CHANGELOG.md");
  if (existsSync(changelog)) {
    const text = readFileSync(changelog, "utf8");
    if (!text.includes(`## ${result.version}`)) {
      const today = new Date().toISOString().slice(0, 10);
      const entry = `## ${result.version} — ${today}\n\n- Include the latest application changes.\n\n`;
      writeFileSync(
        changelog,
        text.replace(/^# Changelog\n+/, `# Changelog\n\n${entry}`),
      );
    }
  }
  console.log(
    `Application version automatically advanced: ${result.previous} -> ${result.version}.`,
  );
}
try {
  if (args.length !== 1)
    throw Error(
      "Usage: node scripts/version.mjs --check|--sync|--auto|patch|minor|major",
    );
  if (args[0] === "--check")
    console.log(
      `Application version consistent: ${checkVersions(root).version}`,
    );
  else if (args[0] === "--auto") automaticBump();
  else {
    const result =
      args[0] === "--sync" ? syncVersion(root) : bumpVersion(root, args[0]);
    console.log(
      `Application version: ${result.previous} -> ${result.version}. All manifests and application lock entries updated; dependencies unchanged.`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
