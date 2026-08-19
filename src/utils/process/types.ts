export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface RetryableError {
  code?: string;
  message?: string;
}

export interface ExecOptions {
  cwd?: string;
  maxRetries?: number;
  retryDelay?: number;
  execFileFn?: ExecFileFn;
  sleepFn?: SleepFn;
}

export type ExecFn = (
  command: string,
  args: string[],
  options?: ExecOptions,
) => Promise<ExecResult>;

export type ExecFileFn = (
  command: string,
  args: string[],
  options: { cwd?: string; encoding: string },
) => Promise<{ stdout: string; stderr: string }>;

export type SleepFn = (ms: number) => Promise<void>;
