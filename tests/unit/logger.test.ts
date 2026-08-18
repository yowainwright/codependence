import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, match } from "../helpers/assertions";
import { createLogger } from "../../src/logger";
import { createAnsiPattern } from "../../src/utils/constants";

describe("Logger", () => {
  let consoleSpy: {
    log: ReturnType<typeof mock.method>;
    error: ReturnType<typeof mock.method>;
    warn: ReturnType<typeof mock.method>;
    debug: ReturnType<typeof mock.method>;
  };

  const stripAnsi = (str: string): string => {
    return str.replace(createAnsiPattern(), "");
  };

  beforeEach(() => {
    consoleSpy = {
      log: mock.method(console, "log", () => {}),
      error: mock.method(console, "error", () => {}),
      warn: mock.method(console, "warn", () => {}),
      debug: mock.method(console, "debug", () => {}),
    };
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("log levels", () => {
    it("should log error messages", () => {
      const logger = createLogger();
      logger.error("Test error");
      assertCalledWith((consoleSpy.error), match.stringContaining("codependence"));
      assertCalledWith((consoleSpy.error), match.stringContaining("Test error"));
    });

    it("should log warning messages", () => {
      const logger = createLogger();
      logger.warn("Test warning");
      assertCalledWith((consoleSpy.warn), match.stringContaining("codependence"));
      assertCalledWith((consoleSpy.warn), match.stringContaining("Test warning"));
    });

    it("should log info messages", () => {
      const logger = createLogger();
      logger.info("Test info");
      assert.ok((consoleSpy.log).mock.callCount() > 0);
      const call = stripAnsi(consoleSpy.log.mock.calls[0].arguments[0]);
      assert.ok((call).includes("codependence"));
      assert.ok((call).includes("Test info"));
    });

    it("should log debug messages when level is debug", () => {
      const logger = createLogger({ level: "debug" });
      logger.debug("Test debug");
      assertCalledWith((consoleSpy.debug), match.stringContaining("codependence"));
      assertCalledWith((consoleSpy.debug), match.stringContaining("Test debug"));
    });

    it("should log verbose messages when level is verbose", () => {
      const logger = createLogger({ level: "verbose" });
      logger.verbose("Test verbose");
      assertCalledWith((consoleSpy.debug), match.stringContaining("codependence"));
      assertCalledWith((consoleSpy.debug), match.stringContaining("Test verbose"));
    });
  });

  describe("log level filtering", () => {
    it("should respect log level hierarchy", () => {
      const logger = createLogger({ level: "warn" });

      logger.error("error message");
      logger.warn("warn message");
      logger.info("info message");
      logger.debug("debug message");

      assert.ok((consoleSpy.error).mock.callCount() > 0);
      assert.ok((consoleSpy.warn).mock.callCount() > 0);
      assert.strictEqual((consoleSpy.log).mock.callCount(), 0);
      assert.strictEqual((consoleSpy.debug).mock.callCount(), 0);
    });

    it("should not log anything when silent is true", () => {
      const logger = createLogger({ silent: true });

      logger.error("test");
      logger.warn("test");
      logger.info("test");
      logger.debug("test");
      logger.verbose("test");

      assert.strictEqual((consoleSpy.log).mock.callCount(), 0);
      assert.strictEqual((consoleSpy.error).mock.callCount(), 0);
      assert.strictEqual((consoleSpy.warn).mock.callCount(), 0);
      assert.strictEqual((consoleSpy.debug).mock.callCount(), 0);
    });
  });

  describe("message formatting", () => {
    it("should format error messages with error details", () => {
      const logger = createLogger();
      const error = new Error("Test error details");
      logger.error("Error occurred", error);
      assertCalledWith((consoleSpy.error), match.stringContaining("Error occurred"));
      assertCalledWith((consoleSpy.error), match.stringContaining("Test error details"));
    });

    it("should handle string errors", () => {
      const logger = createLogger();
      logger.error("Error occurred", "String error");
      assertCalledWith((consoleSpy.error), match.stringContaining("String error"));
    });

    it("should handle debug with data", () => {
      const logger = createLogger({ level: "debug" });
      logger.debug("Debug message", { foo: "bar" });
      assertCalledWith((consoleSpy.debug), match.stringContaining("Debug message"));
      assertCalledWith((consoleSpy.debug), match.stringContaining('"foo": "bar"'));
    });

    it("should handle verbose with data", () => {
      const logger = createLogger({ level: "verbose" });
      logger.verbose("Verbose message", { baz: "qux" });
      assertCalledWith((consoleSpy.debug), match.stringContaining("Verbose message"));
      assertCalledWith((consoleSpy.debug), match.stringContaining('"baz": "qux"'));
    });
  });

  describe("utility methods", () => {
    it("should print plain messages", () => {
      const logger = createLogger();
      logger.print("Plain message");
      assertCalledWith((consoleSpy.log), "Plain message");
    });

    it("should print plain errors", () => {
      const logger = createLogger();
      logger.printError("Plain error");
      assertCalledWith((consoleSpy.error), "Plain error");
    });

    it("should print lines with newline prefix", () => {
      const logger = createLogger();
      logger.line("Line message");
      assertCalledWith((consoleSpy.log), "\nLine message");
    });

    it("should indent messages", () => {
      const logger = createLogger();
      logger.indent("Indented", 4);
      assertCalledWith((consoleSpy.log), "    Indented");
    });

    it("should indent with default 2 spaces", () => {
      const logger = createLogger();
      logger.indent("Default indent");
      assertCalledWith((consoleSpy.log), "  Default indent");
    });

    it("should format numbered items", () => {
      const logger = createLogger();
      logger.item(1, "First item");
      assertCalledWith((consoleSpy.log), "  1. First item");
    });

    it("should add spacing", () => {
      const logger = createLogger();
      logger.space();
      assertCalledWith((consoleSpy.log));
    });

    it("should add separator", () => {
      const logger = createLogger();
      logger.separator();
      assertCalledWith((consoleSpy.log), "─".repeat(50));
    });

    it("should not output utilities when silent", () => {
      const logger = createLogger({ silent: true });

      logger.print("test");
      logger.printError("test");
      logger.line("test");
      logger.indent("test");
      logger.item(1, "test");
      logger.space();
      logger.separator();

      assert.strictEqual((consoleSpy.log).mock.callCount(), 0);
      assert.strictEqual((consoleSpy.error).mock.callCount(), 0);
    });
  });

  describe("structured mode", () => {
    it("should output JSON when structured mode is enabled", () => {
      const logger = createLogger({ structured: true });
      logger.info("Test message");

      assertCalledWith((consoleSpy.log), match.stringMatching(/^\{.*\}$/));

      const logCall = consoleSpy.log.mock.calls[0].arguments[0];
      const parsedLog = JSON.parse(logCall as string);
      assert.strictEqual((parsedLog.level), "info");
      assert.strictEqual((parsedLog.message), "Test message");
      assert.notStrictEqual((parsedLog.timestamp), undefined);
    });

    it("should include data in structured output", () => {
      const logger = createLogger({ structured: true, level: "debug" });
      logger.debug("Debug test", { key: "value" });

      const logCall = consoleSpy.debug.mock.calls[0].arguments[0];
      const parsedLog = JSON.parse(logCall as string);
      assert.deepStrictEqual((parsedLog.data), { key: "value" });
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages", () => {
      const logger = createLogger();
      logger.info("");
      assert.ok((consoleSpy.log).mock.callCount() > 0);
      const call = stripAnsi(consoleSpy.log.mock.calls[0].arguments[0]);
      assert.ok((call).includes("codependence"));
    });

    it("should handle undefined error", () => {
      const logger = createLogger();
      logger.error("Test");
      assert.ok((consoleSpy.error).mock.callCount() > 0);
    });
  });
});
