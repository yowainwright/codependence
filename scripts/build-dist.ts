import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { delimiter, dirname } from "node:path";

const createBuildEnvironment = (): NodeJS.ProcessEnv => {
  const nodeDirectory = dirname(process.execPath);
  const pathEntries = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((pathEntry) => pathEntry !== nodeDirectory);
  const env = { ...process.env, PATH: [nodeDirectory].concat(pathEntries).join(delimiter) };

  delete env.NODE_OPTIONS;
  return env;
};

const runBuildStep = (command: string, args: string[]): void => {
  const env = createBuildEnvironment();
  const result = spawnSync(command, args, { encoding: "utf8", env });
  if (result.error) throw result.error;
  if (result.status === 0) return;
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
};

runBuildStep("rolldown", ["--config", "rolldown.config.mjs"]);
chmodSync("dist/cli.js", 0o755);
