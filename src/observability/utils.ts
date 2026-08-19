import { bold, cyan, gray, red, yellow } from "../dx/output";
import { ICONS, LEVELS } from "./constants";
import type { Log, LogLevel, Logger, LoggerConfig } from "./types";

export const createLoggerConfig = (options: Partial<LoggerConfig>): LoggerConfig =>
  Object.assign(
    {},
    {
      level: "info" as const,
      silent: false,
      structured: false,
    },
    options,
  );

const shouldLog = (config: LoggerConfig, level: LogLevel): boolean => {
  if (config.silent) return false;
  return LEVELS[level] <= LEVELS[config.level];
};

const formatStructured = (level: LogLevel, message: string, extra?: unknown): string => {
  const data = typeof extra === "object" ? extra : undefined;
  const timestamp = new Date().toISOString();
  return JSON.stringify({ level, message, data, timestamp });
};

const formatExtra = (extra?: unknown): string | undefined => {
  if (typeof extra === "string") return extra;
  if (typeof extra === "object") return JSON.stringify(extra, null, 2);
  return undefined;
};

const formatPlain = (
  icon: string,
  color: (text: string) => string,
  message: string,
  extra?: unknown,
): string => {
  const prefix = color("codependence");
  const content = `${prefix}\n  ${icon}  ${message}`;
  const detail = formatExtra(extra);
  return detail ? `${content}\n     ${detail}` : content;
};

const writeLog = (level: LogLevel, message: string): void => {
  if (level === "error") return console.error(message);
  if (level === "warn") return console.warn(message);
  const isDetailed = level === "debug" || level === "verbose";
  if (isDetailed) return console.debug(message);
  console.log(message);
};

export const createLog =
  (config: LoggerConfig): Log =>
  (level, icon, color, message, extra): void => {
    if (!shouldLog(config, level)) return;
    const formatted = config.structured
      ? formatStructured(level, message, extra)
      : formatPlain(icon, color, message, extra);
    writeLog(level, formatted);
  };

const writeUnlessSilent = (config: LoggerConfig, write: () => void): void => {
  if (!config.silent) write();
};

export const createLoggerMethods = (config: LoggerConfig, log: Log): Logger => ({
  error: (message, error) => {
    const detail = error instanceof Error ? error.message : error;
    log("error", ICONS.error, red, message, detail);
  },
  warn: (message) => log("warn", ICONS.warn, yellow, message),
  info: (message) => log("info", ICONS.info, (text) => bold(cyan(text)), message),
  debug: (message, data) => log("debug", ICONS.debug, gray, message, data),
  verbose: (message, data) => log("verbose", ICONS.verbose, gray, message, data),
  print: (message) => writeUnlessSilent(config, () => console.log(message)),
  printError: (message) => writeUnlessSilent(config, () => console.error(message)),
  line: (message) => writeUnlessSilent(config, () => console.log(`\n${message}`)),
  indent: (message, spaces = 2) =>
    writeUnlessSilent(config, () => console.log(`${" ".repeat(spaces)}${message}`)),
  item: (number, message) =>
    writeUnlessSilent(config, () => console.log(`  ${number}. ${message}`)),
  space: () => writeUnlessSilent(config, () => console.log()),
  separator: () => writeUnlessSilent(config, () => console.log("─".repeat(50))),
});
