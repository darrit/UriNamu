import { readFileSync } from "node:fs";
import { keepInstalled } from "./setup-lib.mjs";
const policy = JSON.parse(
  readFileSync(new URL("../dependency-policy.json", import.meta.url), "utf8"),
);
const actualNode = process.versions.node;
const actualNpm = process.env.npm_config_user_agent?.match(
  /(?:^|\s)npm\/([^\s]+)/,
)?.[1];
const problems = [];
if (!keepInstalled(actualNode, policy.node))
  problems.push(`Node at least ${policy.node} required; found: ${actualNode}`);
if (actualNpm && !keepInstalled(actualNpm, policy.npm))
  problems.push(`npm at least ${policy.npm} required; found: ${actualNpm}`);
if (problems.length) {
  console.error(
    problems.join("\n") +
      "\nRun Setup-Windows.cmd or sh setup.sh. See docs/SETUP.md.",
  );
  process.exitCode = 1;
} else
  console.log(
    `Tool versions accepted: Node ${actualNode}${actualNpm ? ", npm " + actualNpm : ""}. Dependency release cutoff: ${policy.cutoff}`,
  );
