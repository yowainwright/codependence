export type LogLevel = "error" | "warn" | "info" | "debug";

export type Reporter = (level: LogLevel, message: string, data?: unknown) => void;
