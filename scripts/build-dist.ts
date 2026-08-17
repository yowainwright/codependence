import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";

const runBuildStep = (command: string, args: string[]): void => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status === 0) return;
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
};

const declarationArgs = [
  "--emitDeclarationOnly",
  "--declaration",
  "--outDir",
  "dist",
  "--rootDir",
  "src",
];

runBuildStep("rolldown", ["--config", "rolldown.config.mjs"]);
runBuildStep("tsc", declarationArgs);
chmodSync("dist/cli.js", 0o755);
