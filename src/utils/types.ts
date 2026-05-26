export interface ExecResult {
  stdout: string;
  stderr: string;
}

export type ExecFileFn = (
  command: string,
  args: string[],
  options: { cwd?: string; encoding: string },
) => Promise<{ stdout: string; stderr: string }>;

export type SleepFn = (ms: number) => Promise<void>;

export interface GlobOptions {
  cwd?: string;
  ignore?: string[];
  absolute?: boolean;
}

export interface PatternPlan {
  pattern: string;
  hasGlobStar: boolean;
}

export interface DirectMatchContext {
  cwd: string;
  ignorePatterns: string[];
}

export interface DirectMatchPlan {
  root: string;
  remainingSegments: string[];
}

export interface DirectMatchStep {
  segment: string;
  isLast: boolean;
}

export interface DirectMatchState {
  candidates: string[];
  results: string[];
}

export type DirectMatchItem =
  | {
      type: "candidate";
      path: string;
    }
  | {
      type: "result";
      path: string;
    };

export interface PromptChoice {
  name: string;
  value: string;
}

export interface SpinnerState {
  text: string;
  isSpinning: boolean;
  frameIndex: number;
  interval: NodeJS.Timeout | null;
}

export interface Spinner {
  text: string;
  start: () => Spinner;
  stop: () => Spinner;
  succeed: (text?: string) => Spinner;
  fail: (text?: string) => Spinner;
  info: (text?: string) => Spinner;
  warn: (text?: string) => Spinner;
}

export interface ErrorContext {
  packageName: string;
  error: Error | string;
  isNetworkError?: boolean;
  isValidationError?: boolean;
  isPrivatePackage?: boolean;
  isRegistryMismatch?: boolean;
  isTimeout?: boolean;
  retryCount?: number;
}
