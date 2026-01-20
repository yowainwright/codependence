import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { createLogger } from "../../src/logger";
import type { LogLevel } from "../../src/logger";

describe("Logger", () => {
  let consoleSpy: {
    log: jest.Mock<any>;
    error: jest.Mock<any>;
    warn: jest.Mock<any>;
    debug: jest.Mock<any>;
  };

  const stripAnsi = (str: string): string => {
    return str.replace(/\x1b\[[0-9;]*m/g, "");
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, "log").mockImplementation(() => {}),
      error: jest.spyOn(console, "error").mockImplementation(() => {}),
      warn: jest.spyOn(console, "warn").mockImplementation(() => {}),
      debug: jest.spyOn(console, "debug").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("log levels", () => {
    it("should log error messages", () => {
      const logger = createLogger();
      logger.error("Test error");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Test error"),
      );
    });

    it("should log warning messages", () => {
      const logger = createLogger();
      logger.warn("Test warning");
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("Test warning"),
      );
    });

    it("should log info messages", () => {
      const logger = createLogger();
      logger.info("Test info");
      expect(consoleSpy.log).toHaveBeenCalled();
      const call = stripAnsi(consoleSpy.log.mock.calls[0][0]);
      expect(call).toContain("codependence");
      expect(call).toContain("Test info");
    });

    it("should log debug messages when level is debug", () => {
      const logger = createLogger({ level: "debug" });
      logger.debug("Test debug");
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("codependence"),
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Test debug"),
      );
    });

    it("should log verbose messages when level is verbose", () => {
      const logger = createLogger({ level: "verbose" });
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
    it("should respect log level hierarchy", () => {
      const logger = createLogger({ level: "warn" });

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
      const logger = createLogger({ silent: true });

      logger.error("test");
      logger.warn("test");
      logger.info("test");
      logger.debug("test");
      logger.verbose("test");

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });
  });

  describe("message formatting", () => {
    it("should format error messages with error details", () => {
      const logger = createLogger();
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
      const logger = createLogger();
      logger.error("Error occurred", "String error");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("String error"),
      );
    });

    it("should handle debug with data", () => {
      const logger = createLogger({ level: "debug" });
      logger.debug("Debug message", { foo: "bar" });
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Debug message"),
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('"foo": "bar"'),
      );
    });

    it("should handle verbose with data", () => {
      const logger = createLogger({ level: "verbose" });
      logger.verbose("Verbose message", { baz: "qux" });
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Verbose message"),
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('"baz": "qux"'),
      );
    });
  });

  describe("utility methods", () => {
    it("should print plain messages", () => {
      const logger = createLogger();
      logger.print("Plain message");
      expect(consoleSpy.log).toHaveBeenCalledWith("Plain message");
    });

    it("should print lines with newline prefix", () => {
      const logger = createLogger();
      logger.line("Line message");
      expect(consoleSpy.log).toHaveBeenCalledWith("\nLine message");
    });

    it("should indent messages", () => {
      const logger = createLogger();
      logger.indent("Indented", 4);
      expect(consoleSpy.log).toHaveBeenCalledWith("    Indented");
    });

    it("should indent with default 2 spaces", () => {
      const logger = createLogger();
      logger.indent("Default indent");
      expect(consoleSpy.log).toHaveBeenCalledWith("  Default indent");
    });

    it("should format numbered items", () => {
      const logger = createLogger();
      logger.item(1, "First item");
      expect(consoleSpy.log).toHaveBeenCalledWith("  1. First item");
    });

    it("should add spacing", () => {
      const logger = createLogger();
      logger.space();
      expect(consoleSpy.log).toHaveBeenCalledWith();
    });

    it("should add separator", () => {
      const logger = createLogger();
      logger.separator();
      expect(consoleSpy.log).toHaveBeenCalledWith("─".repeat(50));
    });

    it("should not output utilities when silent", () => {
      const logger = createLogger({ silent: true });

      logger.print("test");
      logger.line("test");
      logger.indent("test");
      logger.item(1, "test");
      logger.space();
      logger.separator();

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("structured mode", () => {
    it("should output JSON when structured mode is enabled", () => {
      const logger = createLogger({ structured: true });
      logger.info("Test message");

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\{.*\}$/),
      );

      const logCall = consoleSpy.log.mock.calls[0][0];
      const parsedLog = JSON.parse(logCall as string);
      expect(parsedLog.level).toBe("info");
      expect(parsedLog.message).toBe("Test message");
      expect(parsedLog.timestamp).toBeDefined();
    });

    it("should include data in structured output", () => {
      const logger = createLogger({ structured: true, level: "debug" });
      logger.debug("Debug test", { key: "value" });

      const logCall = consoleSpy.debug.mock.calls[0][0];
      const parsedLog = JSON.parse(logCall as string);
      expect(parsedLog.data).toEqual({ key: "value" });
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages", () => {
      const logger = createLogger();
      logger.info("");
      expect(consoleSpy.log).toHaveBeenCalled();
      const call = stripAnsi(consoleSpy.log.mock.calls[0][0]);
      expect(call).toContain("codependence");
    });

    it("should handle undefined error", () => {
      const logger = createLogger();
      logger.error("Test");
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });
});