#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const TARGETS = new Set(["agents", "claude", "codex"]);

const LOCAL_PATHS = {
  agents: ".agents/skills",
  claude: ".claude/rules",
  codex: ".codex/skills",
};

const usage = () => {
  console.error("Usage: node scripts/install-legibility-skill.js [agents|claude|codex] [--local]");
};

const target = process.argv[2] || "agents";
const isLocal = process.argv.includes("--local");

if (!TARGETS.has(target)) {
  usage();
  process.exit(1);
}

const installer = join(
  process.cwd(),
  "node_modules",
  "eslint-plugin-legibility",
  "bin",
  "agent",
  "install.js",
);

if (!existsSync(installer)) {
  console.error("eslint-plugin-legibility is not installed. Run bun install first.");
  process.exit(1);
}

const args = [installer, "--target", target, "--force"];
if (isLocal) {
  args.push("--path", LOCAL_PATHS[target]);
}

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
