import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger, legacyLogger, writeConsoleMsgs } from "../src/logger";
import type { LogLevel } from "../src/logger";

describe("CodependenceLogger", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    };

    logger.configure({ level: "info", silent: false, structured: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("configuration", () => {
    it("should have default configuration", () => {
      const config = logger.getConfig();
      expect(config).toEqual({
        level: "info",
        silent: false,
        structured: false,
      });
    });

    it("should update configuration", () => {
      logger.configure({ level: "debug", silent: true });
      const config = logger.getConfig();
      expect(config.level).toBe("debug");
      expect(config.silent).toBe(true);
      expect(config.structured).toBe(false);
    });
  });

  describe("log levels", () => {
    it("should log error messages", () => {
      logger.error("Test error");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Test error"),
      );
    });

    it("should log warning messages", () => {
      logger.warn("Test warning");
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("Test warning"),
      );
    });

    it("should log info messages", () => {
      logger.info("Test info");
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Test info"),
      );
    });

    it("should log debug messages when level is debug", () => {
      logger.configure({ level: "debug" });
      logger.debug("Test debug");
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Test debug"),
      );
    });

    it("should log verbose messages when level is verbose", () => {
      logger.configure({ level: "verbose" });
      logger.verbose("Test verbose");
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Test verbose"),
      );
    });
  });

  describe("log level filtering", () => {
    const levels: LogLevel[] = ["error", "warn", "info", "debug", "verbose"];

    it("should respect log level hierarchy", () => {
      logger.configure({ level: "warn" });

      logger.error("error message");
      logger.warn("warn message");
      logger.info("info message");
      logger.debug("debug message");

      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it("should not log anything when silent is true", () => {
      logger.configure({ silent: true });

      levels.forEach((level) => {
        logger[level]("test message");
      });

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });
  });

  describe("message formatting", () => {
    it("should include section in header when provided", () => {
      logger.info("Test message", "test-section");
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("codependence:test-section"),
      );
    });

    it("should format error messages with error details", () => {
      const error = new Error("Test error details");
      logger.error("Error occurred", error);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Error occurred"),
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Test error details"),
      );
    });

    it("should handle string errors", () => {
      logger.error("Error occurred", "String error");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("String error"),
      );
    });
  });

  describe("structured logging", () => {
    it("should output JSON when structured mode is enabled", () => {
      logger.configure({ structured: true });
      logger.info("Test message", "test-section");

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\{.*\}$/),
      );

      const logCall = consoleSpy.log.mock.calls[0][0];
      const parsedLog = JSON.parse(logCall);
      expect(parsedLog.level).toBe("info");
      expect(parsedLog.message).toBe("Test message");
      expect(parsedLog.section).toBe("test-section");
      expect(parsedLog.tool).toBe("codependence");
      expect(parsedLog.timestamp).toBeDefined();
    });
  });

  describe("dependency issues", () => {
    it("should log dependency issues with proper formatting", () => {
      const issues = [
        { name: "lodash", expected: "^4.17.21", actual: "4.17.20" },
        { name: "express", expected: "^4.18.0", actual: "4.17.1" },
      ];

      logger.dependencyIssues("test-package", issues);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Found 2 dependency issues"),
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("lodash: found 4.17.20, expected ^4.17.21"),
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("express: found 4.17.1, expected ^4.18.0"),
      );
    });

    it("should handle single dependency issue", () => {
      const issues = [
        { name: "lodash", expected: "^4.17.21", actual: "4.17.20" },
      ];

      logger.dependencyIssues("test-package", issues);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 dependency issue"),
      );
    });

    it("should not log when no issues", () => {
      logger.dependencyIssues("test-package", []);
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("should not log dependency issues when log level is too low", () => {
      logger.configure({ level: "error" });
      const issues = [
        { name: "lodash", expected: "^4.17.21", actual: "4.17.20" },
      ];

      logger.dependencyIssues("test-package", issues);
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("utility methods", () => {
    it("should add spacing when not silent and not structured", () => {
      logger.space();
      expect(consoleSpy.log).toHaveBeenCalledWith();
    });

    it("should not add spacing when silent", () => {
      logger.configure({ silent: true });
      logger.space();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("should not add spacing when structured", () => {
      logger.configure({ structured: true });
      logger.space();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("should add separator when not silent and not structured", () => {
      logger.separator();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("─"));
    });

    it("should not add separator when silent", () => {
      logger.configure({ silent: true });
      logger.separator();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("legacy compatibility", () => {
    it("should handle legacy logger calls", () => {
      legacyLogger({
        type: "error",
        message: "Legacy error",
        section: "legacy",
      });
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Legacy error"),
      );
    });

    it("should convert log type to info", () => {
      legacyLogger({ type: "log", message: "Legacy log" });
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Legacy log"),
      );
    });

    it("should handle debugging mode", () => {
      logger.configure({ level: "debug" });
      legacyLogger({ type: "info", message: "Debug test", isDebugging: true });
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Debug test"),
      );
    });

    it("should handle writeConsoleMsgs", () => {
      const depList = [
        { name: "lodash", expected: "^4.17.21", actual: "4.17.20" },
      ];

      writeConsoleMsgs("test-package", depList);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 dependency issue"),
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages", () => {
      logger.info("");
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
    });

    it("should handle undefined error in legacy logger", () => {
      legacyLogger({ type: "error", message: "Test" });
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it("should handle empty section", () => {
      logger.info("Test message", "");
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
    });
  });
});
