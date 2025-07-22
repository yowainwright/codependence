import gradient from "gradient-string";

import type {
  LogLevel,
  LoggerConfig,
  LogEntry,
  DependencyIssue,
  LoggerParams,
} from "./types";

/**
 * Enhanced logging system for Codependence with branded styling and multiple output formats
 */
class CodependenceLogger {
  private config: LoggerConfig = {
    level: "info",
    silent: false,
    structured: false,
  };

  private levels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4,
  };

  private colors = {
    error: gradient.passion,
    warn: gradient.fruit,
    info: gradient.teen,
    debug: gradient.mind,
    verbose: gradient.cristal,
  };

  private emojis = {
    error: "❌",
    warn: "⚠️",
    info: "🤼‍♀️",
    debug: "🔍",
    verbose: "📝",
  };

  /**
   * Configure logger settings
   * @param config - Partial configuration object to merge with existing settings
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current logger configuration
   * @returns Current logger configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Determine if a log level should be output based on current configuration
   * @param level - Log level to check
   * @returns Whether the log should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.config.silent) return false;
    return this.levels[level] <= this.levels[this.config.level];
  }

  /**
   * Format a log entry into a styled console message
   * @param entry - Log entry to format
   * @returns Formatted string ready for console output
   */
  private formatMessage(entry: LogEntry): string {
    const { level, section, message, error } = entry;
    const emoji = this.emojis[level];
    const colorFunction = this.colors[level];

    const sectionPrefix = section ? `codependence:${section}` : "codependence";
    const coloredHeader = colorFunction(`${sectionPrefix}`);

    const formattedContent = message ? `\n  ${emoji}  ${message}` : "";

    const formattedError = error ? `\n     ${error.toString()}` : "";

    return `${coloredHeader}${formattedContent}${formattedError}`;
  }

  /**
   * Output a log entry to the appropriate console method
   * @param entry - Log entry to output
   */
  private output(entry: LogEntry): void {
    const shouldOutputLog = this.shouldLog(entry.level);
    if (!shouldOutputLog) return;

    if (this.config.structured) {
      const structuredLogEntry = {
        ...entry,
        timestamp: new Date(),
        tool: "codependence",
      };
      console.log(JSON.stringify(structuredLogEntry));
      return;
    }

    const formattedMessage = this.formatMessage(entry);

    switch (entry.level) {
      case "error":
        console.error(formattedMessage);
        break;
      case "warn":
        console.warn(formattedMessage);
        break;
      case "debug":
      case "verbose":
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  /**
   * Log an error message with optional error details
   * @param message - Error message to display
   * @param error - Optional error object or string
   * @param section - Optional section name for context
   */
  error(message: string, error?: string | Error, section?: string): void {
    this.output({ level: "error", message, error, section });
  }

  /**
   * Log a warning message
   * @param message - Warning message to display
   * @param section - Optional section name for context
   */
  warn(message: string, section?: string): void {
    this.output({ level: "warn", message, section });
  }

  /**
   * Log an informational message
   * @param message - Info message to display
   * @param section - Optional section name for context
   */
  info(message: string, section?: string): void {
    this.output({ level: "info", message, section });
  }

  /**
   * Log a debug message with optional data
   * @param message - Debug message to display
   * @param data - Optional data object for debugging
   * @param section - Optional section name for context
   */
  debug(message: string, data?: any, section?: string): void {
    this.output({ level: "debug", message, data, section });
  }

  /**
   * Log a verbose message with optional data
   * @param message - Verbose message to display
   * @param data - Optional data object for verbose output
   * @param section - Optional section name for context
   */
  verbose(message: string, data?: any, section?: string): void {
    this.output({ level: "verbose", message, data, section });
  }

  /**
   * Log dependency version mismatches in a structured format
   * @param packageName - Name of the package being checked
   * @param issues - Array of dependency issues with expected and actual versions
   */
  dependencyIssues(packageName: string, issues: Array<DependencyIssue>): void {
    const hasNoIssues = !issues.length;
    const cannotLog = !this.shouldLog("info");
    const shouldSkipLogging = hasNoIssues || cannotLog;

    if (shouldSkipLogging) return;

    const issueCount = issues.length;
    const pluralizedIssues = issueCount > 1 ? "s" : "";
    this.info(
      `Found ${issueCount} dependency issue${pluralizedIssues}`,
      packageName,
    );

    issues.forEach(({ name, expected, actual }) => {
      const versionMismatchMessage = `${name}: found ${actual}, expected ${expected}`;
      console.log(`     🔄  ${versionMismatchMessage}`);
    });

    console.log();
  }

  /**
   * Add vertical spacing to console output for better readability
   */
  space(): void {
    const shouldAddSpacing = !this.config.silent && !this.config.structured;
    if (shouldAddSpacing) {
      console.log();
    }
  }

  /**
   * Add a visual separator line to console output
   */
  separator(): void {
    const shouldShowSeparator = !this.config.silent && !this.config.structured;
    if (shouldShowSeparator) {
      const separatorLine = gradient.teen("  ─".repeat(50));
      console.log(separatorLine);
    }
  }
}

/**
 * Singleton logger instance for consistent usage across the application
 */
export const logger = new CodependenceLogger();

/**
 * Legacy logger function for backward compatibility with existing code
 * @param params - Legacy logger parameters
 * @deprecated Use the new logger methods instead
 */
export const legacyLogger = ({
  type,
  section = "",
  message,
  err = "",
  isDebugging = false,
}: LoggerParams): void => {
  const normalizedLevel = type === "log" ? "info" : (type as LogLevel);
  const shouldUseDebugMode = isDebugging && normalizedLevel !== "debug";
  const messageContent = message || "";

  if (shouldUseDebugMode) {
    logger.debug(messageContent, err, section);
    return;
  }

  switch (normalizedLevel) {
    case "error":
      logger.error(messageContent, err, section);
      break;
    case "warn":
      logger.warn(messageContent, section);
      break;
    case "debug":
      logger.debug(messageContent, err, section);
      break;
    default:
      logger.info(messageContent, section);
  }
};

/**
 * Write console messages for dependency issues
 * @param packageName - Name of the package with issues
 * @param depList - Array of dependency objects with version information
 * @deprecated Use logger.dependencyIssues() instead
 */
export const writeConsoleMsgs = (
  packageName: string,
  depList: Array<Record<string, string>>,
): void => {
  const transformedIssues = depList.map(({ name, expected, actual }) => ({
    name,
    expected,
    actual,
  }));
  logger.dependencyIssues(packageName, transformedIssues);
};

export type {
  LogLevel,
  LoggerConfig,
  LogEntry,
  DependencyIssue,
  LoggerParams,
} from "./types";
