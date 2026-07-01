import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";

const outputDir = "dist/bin";
const outputFile = `${outputDir}/codependence`;
const args = ["compile", "src/bin/index.ts", "-o", outputFile, "--quiet"];

mkdirSync(outputDir, { recursive: true });

const result = spawnSync("perry", args, { encoding: "utf8" });

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

const sizeInMb = (statSync(outputFile).size / 1024 / 1024).toFixed(1);
console.log(`Built ${outputFile} (${sizeInMb}MB)`);
