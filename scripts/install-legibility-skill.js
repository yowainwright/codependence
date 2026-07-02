#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const TARGETS = new Set(["agents", "claude", "codex"]);
const require = createRequire(import.meta.url);

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

const resolveInstaller = () => {
  try {
    const packageJsonPath = require.resolve("eslint-plugin-legibility/package.json");
    return join(dirname(packageJsonPath), "bin", "agent", "install.js");
  } catch {
    return "";
  }
};

const installer = resolveInstaller();

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
