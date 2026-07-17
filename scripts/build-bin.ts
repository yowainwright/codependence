import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import {
  BIN_BUILD_ARGS,
  BIN_OUTPUT_DIR,
  BIN_OUTPUT_FILE,
} from "./constants";

mkdirSync(BIN_OUTPUT_DIR, { recursive: true });

const result = spawnSync("perry", BIN_BUILD_ARGS, { encoding: "utf8" });

if (result.error) {
  throw result.error;
}

const exitCode = result.status ?? 1;
const hasFailed = exitCode !== 0;

if (hasFailed) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(exitCode);
}

const sizeInMb = (statSync(BIN_OUTPUT_FILE).size / 1024 / 1024).toFixed(1);
console.log(`Built ${BIN_OUTPUT_FILE} (${sizeInMb}MB)`);
