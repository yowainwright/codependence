export type LogLevel = "error" | "warn" | "info" | "debug" | "verbose";

export interface LoggerConfig {
  level: LogLevel;
  silent: boolean;
  structured: boolean;
}

export interface Logger {
  error: (message: string, error?: Error | string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
  debug: (message: string, data?: unknown) => void;
  verbose: (message: string, data?: unknown) => void;
  print: (message: string) => void;
  line: (message: string) => void;
  indent: (message: string, spaces?: number) => void;
  item: (n: number, message: string) => void;
  space: () => void;
  separator: () => void;
}
