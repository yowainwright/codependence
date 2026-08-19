import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RETRYABLE_ERROR_CODES } from "./constants";
import type { ExecFileFn, ExecResult, RetryableError, SleepFn } from "./types";

export const execFileAsync = promisify(execFile) as ExecFileFn;
export const sleep: SleepFn = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const retryableError = error as RetryableError;
  const hasRetryableCode =
    retryableError.code !== undefined && RETRYABLE_ERROR_CODES.includes(retryableError.code);
  if (hasRetryableCode) return true;
  const message = retryableError.message?.toLowerCase() || "";
  return message.includes("timeout") || message.includes("network");
};

export const executeWithRetry = async (
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
    const { stdout, stderr } = await execFileFn(command, args, { cwd, encoding: "utf8" });
    return { stdout: stdout || "", stderr: stderr || "" };
  } catch (error) {
    const shouldRetry = isRetryableError(error) && attempt < maxRetries - 1;
    if (!shouldRetry) throw error;
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
