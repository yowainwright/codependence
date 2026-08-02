import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import {
  BIN_BUILD_ARGS,
  BIN_BUNDLE_ARGS,
  BIN_ENTRY_FILE,
  BIN_ENTRY_SOURCE_FILE,
  BIN_OUTPUT_DIR,
  BIN_OUTPUT_FILE,
  BIN_RUNTIME_DIR,
  BIN_RUNTIME_NAME,
  BIN_RUNTIME_PACKAGE_FILE,
  BIN_RUNTIME_TYPES_FILE,
} from "./constants";

const runBuildStep = (command: string, args: string[]): void => {
  const result = spawnSync(command, args, { encoding: "utf8" });

  if (result.error) throw result.error;
  if (result.status === 0) return;

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
};

const prepareBinaryRuntime = (): void => {
  const packageManifest = {
    main: "index.js",
    name: BIN_RUNTIME_NAME,
    type: "module",
    types: "index.d.ts",
  };
  const packageJson = `${JSON.stringify(packageManifest, null, 2)}\n`;
  const packageTypes = [
    "type Exec = (command: string, args: string[], cwd: string) => Promise<string>;",
    "type ExecSync = (command: string, args: string[], cwd: string) => string;",
    "type Question = (message: string) => Promise<string>;",
    "export function configureBinaryHost(exec: Exec, execSync: ExecSync, question: Question): void;",
    "export function runBinary(argv: readonly string[]): Promise<void>;",
    "",
  ].join("\n");

  rmSync(BIN_RUNTIME_DIR, { force: true, recursive: true });
  mkdirSync(BIN_RUNTIME_DIR, { recursive: true });
  copyFileSync(BIN_ENTRY_SOURCE_FILE, BIN_ENTRY_FILE);
  writeFileSync(BIN_RUNTIME_PACKAGE_FILE, packageJson);
  writeFileSync(BIN_RUNTIME_TYPES_FILE, packageTypes);
};

mkdirSync(BIN_OUTPUT_DIR, { recursive: true });
prepareBinaryRuntime();
runBuildStep("bun", BIN_BUNDLE_ARGS);
runBuildStep("scriptc", BIN_BUILD_ARGS);
rmSync(BIN_ENTRY_FILE, { force: true });
rmSync(BIN_RUNTIME_DIR, { force: true, recursive: true });

const sizeInMb = (statSync(BIN_OUTPUT_FILE).size / 1024 / 1024).toFixed(1);
console.log(`Built ${BIN_OUTPUT_FILE} (${sizeInMb}MB)`);
