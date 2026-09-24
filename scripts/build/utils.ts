import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";
import {
  BIN_BUILD_ARGS,
  BIN_BUNDLE_ARGS,
  BIN_ENTRY_FILE,
  BIN_ENTRY_SOURCE,
  BIN_OUTPUT_DIR,
  BIN_OUTPUT_FILE,
  BIN_RUNTIME_DIR,
  BIN_RUNTIME_NAME,
  BIN_RUNTIME_PACKAGE_FILE,
  BIN_RUNTIME_TYPES_FILE,
  DIST_BUNDLES,
} from "./constants";
import type { BuildMode, BuildReport } from "./types";

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

const binaryRuntimeManifest = (): string => {
  const packageManifest = {
    main: "index.js",
    name: BIN_RUNTIME_NAME,
    type: "module",
    types: "index.d.ts",
  };
  return `${JSON.stringify(packageManifest, null, 2)}\n`;
};

const binaryRuntimeTypes = (): string => {
  return [
    "type Exec = (command: string, args: string[], cwd: string) => Promise<string>;",
    "type ExecSync = (command: string, args: string[], cwd: string) => string;",
    "type Question = (message: string) => Promise<string>;",
    "export function configureBinaryHost(exec: Exec, execSync: ExecSync, question: Question): () => void;",
    "export function runBinary(argv: readonly string[]): Promise<void>;",
    "",
  ].join("\n");
};

const prepareBinaryRuntime = (): void => {
  rmSync(BIN_RUNTIME_DIR, { force: true, recursive: true });
  mkdirSync(BIN_RUNTIME_DIR, { recursive: true });
  writeFileSync(BIN_ENTRY_FILE, BIN_ENTRY_SOURCE);
  writeFileSync(BIN_RUNTIME_PACKAGE_FILE, binaryRuntimeManifest());
  writeFileSync(BIN_RUNTIME_TYPES_FILE, binaryRuntimeTypes());
};

const reportBinaryBuild = (): void => {
  const sizeInMb = (statSync(BIN_OUTPUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`Built ${BIN_OUTPUT_FILE} (${sizeInMb}MB)`);
};

export const buildDist = (): void => {
  DIST_BUNDLES.forEach((bundle) => runBuildStep("rolldown", bundle.args));
  chmodSync("dist/cli.js", 0o755);
};

export const prepareLinuxCompiler = (compilerPath: string): void => {
  const compilerRequire = createRequire(compilerPath);
  const helperManifest = compilerRequire.resolve("@scriptc/llvm-linux-x64-gnu/package.json");
  const helperPath = join(dirname(helperManifest), "bin", "scriptc-llvm-codegen");
  const mode = statSync(helperPath).mode;
  const isExecutable = (mode & 0o111) === 0o111;
  if (isExecutable) return;
  chmodSync(helperPath, mode | 0o111);
};

const prepareBinaryCompiler = (): void => {
  const isLinuxX64 = process.platform === "linux" && process.arch === "x64";
  if (!isLinuxX64) return;
  const report = process.report.getReport() as BuildReport;
  if (!report.header.glibcVersionRuntime) return;
  const scriptcRequire = createRequire(import.meta.resolve("scriptc/package.json"));
  const compilerPath = scriptcRequire.resolve("@scriptc/compiler");
  prepareLinuxCompiler(compilerPath);
};

export const buildBin = (): void => {
  mkdirSync(BIN_OUTPUT_DIR, { recursive: true });
  prepareBinaryRuntime();
  prepareBinaryCompiler();
  runBuildStep("rolldown", BIN_BUNDLE_ARGS);
  runBuildStep("scriptc", BIN_BUILD_ARGS);
  rmSync(BIN_ENTRY_FILE, { force: true });
  rmSync(BIN_RUNTIME_DIR, { force: true, recursive: true });
  reportBinaryBuild();
};

export const resolveBuildMode = (value: string | undefined): BuildMode => {
  const isKnownMode = value === "bin" || value === "dist";
  if (isKnownMode) return value;
  if (value === undefined) return "dist";
  throw new Error(`Unknown build mode: ${value}`);
};
