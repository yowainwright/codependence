import type { BuildBundle } from "./types";

export const DIST_BUNDLES: BuildBundle[] = [
  {
    args: ["src/index.ts", "--file", "dist/index.js", "--format", "esm", "--platform", "node"],
    outputFile: "dist/index.js",
  },
  {
    args: ["src/index.ts", "--file", "dist/index.cjs", "--format", "cjs", "--platform", "node"],
    outputFile: "dist/index.cjs",
  },
  {
    args: ["src/cli/index.ts", "--file", "dist/cli.js", "--format", "esm", "--platform", "node"],
    outputFile: "dist/cli.js",
  },
];

export const BIN_OUTPUT_DIR = "artifacts";
export const BIN_OUTPUT_FILE = `${BIN_OUTPUT_DIR}/codependence`;
export const BIN_ENTRY_FILE = `${BIN_OUTPUT_DIR}/entry.ts`;
export const BIN_RUNTIME_NAME = "codependence-runtime";
export const BIN_RUNTIME_SOURCE_FILE = "src/cli/index.ts";
export const BIN_RUNTIME_DIR = `${BIN_OUTPUT_DIR}/node_modules/${BIN_RUNTIME_NAME}`;
export const BIN_RUNTIME_PACKAGE_FILE = `${BIN_RUNTIME_DIR}/package.json`;
export const BIN_RUNTIME_TYPES_FILE = `${BIN_RUNTIME_DIR}/index.d.ts`;
export const BIN_BUNDLE_FILE = `${BIN_RUNTIME_DIR}/index.js`;
export const BIN_BUNDLE_ARGS = [
  BIN_RUNTIME_SOURCE_FILE,
  "--file",
  BIN_BUNDLE_FILE,
  "--format",
  "esm",
  "--platform",
  "node",
  "--minify",
];
export const BIN_BUILD_ARGS = [
  "build",
  BIN_ENTRY_FILE,
  "-o",
  BIN_OUTPUT_FILE,
  "--dynamic",
  "--no-keep-c",
];

export const BIN_ENTRY_SOURCE = `import { execFileSync, spawn } from "child_process";
import type { ChildProcess } from "child_process";
import * as readline from "readline";
import { configureBinaryHost, runBinary } from "codependence-runtime";

const hostResult = (stdout: string, stderr: string, error: string): string =>
  JSON.stringify({ stdout, stderr, error });

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const execute = (command: string, args: string[], cwd: string): Promise<string> =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let stdoutEnded = false;
    let stderrEnded = false;
    let processExited = false;
    let processSucceeded = false;
    const workingDirectory = cwd || process.cwd();
    const child: ChildProcess = spawn(command, args, {
      cwd: workingDirectory,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finish = (error: string): void => {
      if (settled) return;
      settled = true;
      resolve(hostResult(stdout, stderr, error));
    };
    const finishIfComplete = (): void => {
      const isComplete = processExited && stdoutEnded && stderrEnded;
      if (!isComplete) return;

      const error = processSucceeded ? "" : \`Command failed: \${command}\\n\${stderr}\`;
      finish(error);
    };

    if (child.stdout) {
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stdout.on("end", () => {
        stdoutEnded = true;
        finishIfComplete();
      });
    } else {
      stdoutEnded = true;
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.stderr.on("end", () => {
        stderrEnded = true;
        finishIfComplete();
      });
    } else {
      stderrEnded = true;
    }
    child.on("error", (error) => finish(error.message));
    child.on("exit", (code) => {
      processExited = true;
      processSucceeded = code === 0;
      finishIfComplete();
    });
  });

const executeSync = (command: string, args: string[], cwd: string): string => {
  try {
    const workingDirectory = cwd || process.cwd();
    execFileSync(command, args, { cwd: workingDirectory, stdio: "ignore" });
    return hostResult("", "", "");
  } catch (error) {
    return hostResult("", "", errorMessage(error));
  }
};

const question = (message: string): Promise<string> =>
  new Promise((resolve) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);

    const input = readline.createInterface({ input: process.stdin, output: process.stdout });
    input.question(message, (answer) => {
      input.close();
      resolve(answer);
    });
  });

configureBinaryHost(execute, executeSync, question);
void runBinary(process.argv);
`;
