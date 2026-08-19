import type { LoggerConfig, Logger } from "./types";
import { createLoggerConfig, createLoggerMethods, createLog } from "./utils";

export const createLogger = (options: Partial<LoggerConfig> = {}): Logger => {
  const config = createLoggerConfig(options);
  const log = createLog(config);
  return createLoggerMethods(config, log);
};

export const logger = createLogger();

export type { LogLevel, LoggerConfig, Logger } from "./types";
