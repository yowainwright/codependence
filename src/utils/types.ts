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

export interface CacheEntry {
  value: string;
  timestamp: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export interface FormattedDependency {
  package: string;
  current: string;
  latest: string;
  isPinned: boolean;
  severity: "major" | "minor" | "patch" | "unknown";
  canAutoUpdate: boolean;
}

export interface FormattedSummary {
  totalPackages: number;
  outdated: number;
  upToDate: number;
  duration?: number;
}

export interface FormattedOutput {
  status: "outdated" | "up-to-date";
  exitCode: number;
  dependencies: FormattedDependency[];
  summary: FormattedSummary;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export interface TableRow {
  [key: string]: string;
}

export interface TableVersionDiff {
  package: string;
  current: string;
  latest: string;
  isPinned: boolean;
}

export interface ValidationResult {
  validForNewPackages: boolean;
  validForOldPackages: boolean;
  warnings?: string[];
  errors?: string[];
}
