import { LOG_PREFIX } from "./constants";
import type { LogLevel, Reporter } from "./types";

class LoggerService {
  private static instance: LoggerService;
  private reporters: Reporter[] = [];

  private constructor() {}

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (data !== undefined) {
      console[level](LOG_PREFIX, message, data);
    } else {
      console[level](LOG_PREFIX, message);
    }
    this.reporters.forEach((r) => r(level, message, data));
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  /**
   * Register a reporter to receive all log events.
   * Use this to wire up Sentry, Datadog, or any other error tracking service.
   *
   * Example:
   *   logger.addReporter((level, message, data) => {
   *     if (level === 'error') Sentry.captureMessage(message, { extra: data });
   *   });
   */
  addReporter(reporter: Reporter): void {
    this.reporters.push(reporter);
  }
}

export const logger = LoggerService.getInstance();

export type { LogLevel, Reporter } from "./types";
