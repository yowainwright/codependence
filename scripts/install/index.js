import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INSTALL_TARGETS = ["agents", "claude", "codex"];
const require = createRequire(import.meta.url);

const LOCAL_INSTALL_PATHS = {
  agents: ".agents/skills",
  claude: ".claude/rules",
  codex: ".codex/skills",
};

const usage = "Usage: node scripts/install/index.js [agents|claude|codex] [--local]";

export const resolveLegibilityInstaller = () => {
  try {
    const packageJsonPath = require.resolve("eslint-plugin-legibility/package.json");
    return join(dirname(packageJsonPath), "bin", "agent", "install.js");
  } catch {
    return "";
  }
};

export const installArgs = (installer, target, isLocal) => {
  const args = [installer, "--target", target, "--force"];
  if (!isLocal) return args;

  return args.concat("--path", LOCAL_INSTALL_PATHS[target]);
};

export const runInstallCommand = (options = {}) => {
  const argv = options.argv ?? process.argv.slice(2);
  const target = argv[0] || "agents";
  const isLocal = argv.includes("--local");
  const writeError = options.writeError ?? console.error;
  const isTargetSupported = INSTALL_TARGETS.includes(target);
  if (!isTargetSupported) {
    writeError(usage);
    return 1;
  }

  const installer = options.installer ?? resolveLegibilityInstaller();
  const hasInstaller = options.exists ?? existsSync;
  if (!hasInstaller(installer)) {
    writeError("eslint-plugin-legibility is not installed. Run nub install first.");
    return 1;
  }

  const spawn = options.spawn ?? spawnSync;
  const result = spawn(process.execPath, installArgs(installer, target, isLocal), {
    stdio: "inherit",
  });
  if (result.error) {
    writeError(result.error.message);
    return 1;
  }

  return result.status ?? 1;
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runInstallCommand();
}
