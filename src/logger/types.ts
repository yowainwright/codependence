export type LogLevel = "error" | "warn" | "info" | "debug" | "verbose";

export interface LoggerConfig {
  level: LogLevel;
  silent: boolean;
  structured: boolean;
}

export interface LogEntry {
  level: LogLevel;
  section?: string;
  message?: string;
  error?: string | Error;
  data?: any;
  timestamp?: Date;
}

export interface DependencyIssue {
  name: string;
  expected: string;
  actual: string;
}

export interface LoggerParams {
  type: "info" | "warn" | "error" | "log" | string;
  section?: string;
  message?: string;
  err?: string;
  isDebugging?: boolean;
  obj?: any;
}
