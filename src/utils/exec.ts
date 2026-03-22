import { execFile } from "child_process";
import { promisify } from "util";
import type { ExecResult, ExecFileFn, SleepFn } from "./types";

const execFileAsync = promisify(execFile) as ExecFileFn;

const sleep: SleepFn = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const err = error as { code?: string; message?: string };
  const retryableCodes = ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"];

  if (err.code && retryableCodes.includes(err.code)) return true;

  const message = err.message?.toLowerCase() || "";
  return message.includes("timeout") || message.includes("network");
};

const executeWithRetry = async (
  command: string,
  args: string[],
  cwd: string | undefined,
  attempt: number,
  maxRetries: number,
  retryDelay: number,
  execFileFn: ExecFileFn,
  sleepFn: SleepFn,
): Promise<ExecResult> => {
  try {
    const { stdout, stderr } = await execFileFn(command, args, {
      cwd,
      encoding: "utf8",
    });

    return {
      stdout: stdout || "",
      stderr: stderr || "",
    };
  } catch (error) {
    const shouldRetry = isRetryableError(error) && attempt < maxRetries - 1;

    if (!shouldRetry) {
      throw error;
    }

    const backoffDelay = retryDelay * Math.pow(2, attempt);
    await sleepFn(backoffDelay);

    return executeWithRetry(
      command,
      args,
      cwd,
      attempt + 1,
      maxRetries,
      retryDelay,
      execFileFn,
      sleepFn,
    );
  }
};

export const exec = async (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    maxRetries?: number;
    retryDelay?: number;
    execFileFn?: ExecFileFn;
    sleepFn?: SleepFn;
  } = {},
): Promise<ExecResult> => {
  const {
    cwd,
    maxRetries = 3,
    retryDelay = 1000,
    execFileFn: execFileFnOpt = execFileAsync,
    sleepFn: sleepFnOpt = sleep,
  } = options;

  return executeWithRetry(command, args, cwd, 0, maxRetries, retryDelay, execFileFnOpt, sleepFnOpt);
};
