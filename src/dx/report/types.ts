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
