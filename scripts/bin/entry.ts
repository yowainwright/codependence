import { execFileSync, spawn } from "child_process";
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

      const error = processSucceeded ? "" : `Command failed: ${command}\n${stderr}`;
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
