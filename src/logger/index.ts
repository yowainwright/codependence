import { cyan, red, yellow, gray, bold } from "../utils/colors";
import type { LogLevel, LoggerConfig, Logger } from "./types";
import { ICONS, LEVELS } from "./constants";

export const createLogger = (options: Partial<LoggerConfig> = {}): Logger => {
  const config: LoggerConfig = {
    level: "info",
    silent: false,
    structured: false,
    ...options,
  };

  const shouldLog = (level: LogLevel): boolean => {
    if (config.silent) return false;
    return LEVELS[level] <= LEVELS[config.level];
  };

  const formatStructured = (level: LogLevel, message: string, extra?: unknown) => {
    return JSON.stringify({
      level,
      message,
      data: typeof extra === "object" ? extra : undefined,
      timestamp: new Date().toISOString(),
    });
  };

  const formatPlain = (icon: string, color: (text: string) => string, message: string, extra?: string | unknown) => {
    const prefix = color("codependence");
    const content = `${prefix}\n  ${icon}  ${message}`;
    const extraString = typeof extra === "string" ? extra : typeof extra === "object" ? JSON.stringify(extra, null, 2) : undefined;
    return extraString ? `${content}\n     ${extraString}` : content;
  };

  const output = (level: LogLevel, message: string) => {
    const isError = level === "error";
    const isWarn = level === "warn";
    const isDebugVerbose = level === "debug" || level === "verbose";

    if (isError) console.error(message);
    else if (isWarn) console.warn(message);
    else if (isDebugVerbose) console.debug(message);
    else console.log(message);
  };

  const log = (level: LogLevel, icon: string, color: (text: string) => string, message: string, extra?: string | unknown) => {
    if (!shouldLog(level)) return;

    const formatted = config.structured
      ? formatStructured(level, message, extra)
      : formatPlain(icon, color, message, extra);

    output(level, formatted);
  };

  return {
    error: (message: string, error?: Error | string) => {
      const errorMessage = error instanceof Error ? error.message : error;
      log("error", ICONS.error, red, message, errorMessage);
    },

    warn: (message: string) => {
      log("warn", ICONS.warn, yellow, message);
    },

    info: (message: string) => {
      log("info", ICONS.info, (text) => bold(cyan(text)), message);
    },

    debug: (message: string, data?: unknown) => {
      log("debug", ICONS.debug, gray, message, data);
    },

    verbose: (message: string, data?: unknown) => {
      log("verbose", ICONS.verbose, gray, message, data);
    },

    print: (message: string) => {
      if (!config.silent) console.log(message);
    },

    line: (message: string) => {
      if (!config.silent) console.log("\n" + message);
    },

    indent: (message: string, spaces: number = 2) => {
      if (!config.silent) console.log(" ".repeat(spaces) + message);
    },

    item: (n: number, message: string) => {
      if (!config.silent) console.log(`  ${n}. ${message}`);
    },

    space: () => {
      if (!config.silent) console.log();
    },

    separator: () => {
      if (!config.silent) console.log("─".repeat(50));
    },
  };
};

export const logger = createLogger();

export type { LogLevel, LoggerConfig, Logger } from "./types";