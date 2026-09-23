import { binaryExecFile } from "../../cli/utils";
import { DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY_MS } from "./constants";
import type { ExecFn } from "./types";
import { execFileAsync, executeWithRetry, sleep } from "./utils";

export const exec: ExecFn = (command, args, options = {}) => {
  const defaultExecFile = binaryExecFile() || execFileAsync;
  const {
    cwd,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY_MS,
    execFileFn = defaultExecFile,
    sleepFn = sleep,
  } = options;
  const retryOptions = { cwd, maxRetries, retryDelay, execFileFn, sleepFn };
  return executeWithRetry(command, args, retryOptions);
};

export type { ExecFileFn, ExecFn, ExecOptions, ExecResult, RetryableError, SleepFn } from "./types";
