import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAnsiPattern } from "../../../../src/dx/constants";
import {
  green,
  red,
  yellow,
  cyan,
  gray,
  bold,
  gradient,
  success,
  error,
} from "../../../../src/dx/output";

describe("colors", () => {
  it("should apply green color", () => {
    const result = green("test");
    assert.strictEqual(result, "\x1b[32mtest\x1b[0m");
  });

  it("should apply red color", () => {
    const result = red("error");
    assert.strictEqual(result, "\x1b[31merror\x1b[0m");
  });

  it("should apply yellow color", () => {
    const result = yellow("warning");
    assert.strictEqual(result, "\x1b[33mwarning\x1b[0m");
  });

  it("should apply cyan color", () => {
    const result = cyan("info");
    assert.strictEqual(result, "\x1b[36minfo\x1b[0m");
  });

  it("should apply gray color", () => {
    const result = gray("debug");
    assert.strictEqual(result, "\x1b[90mdebug\x1b[0m");
  });

  it("should apply bold style", () => {
    const result = bold("important");
    assert.strictEqual(result, "\x1b[1mimportant\x1b[0m");
  });

  it("should apply gradient", () => {
    const result = gradient("codependence");
    const plain = result.replace(createAnsiPattern(), "");
    assert.ok(result.includes("\x1b[38;2;0;194;255m"));
    assert.ok(result.includes("\x1b[38;2;188;92;255m"));
    assert.ok(result.includes("\x1b[1m"));
    assert.strictEqual(plain, "codependence");
  });

  it("should handle empty strings", () => {
    assert.strictEqual(green(""), "\x1b[32m\x1b[0m");
    assert.strictEqual(red(""), "\x1b[31m\x1b[0m");
  });

  describe("success utility", () => {
    it("should apply green color with default checkmark", () => {
      const result = success();
      assert.strictEqual(result, "\x1b[32m✓\x1b[0m");
    });

    it("should apply green color to custom text", () => {
      const result = success("PASS");
      assert.strictEqual(result, "\x1b[32mPASS\x1b[0m");
    });

    it("should apply green color to success symbol", () => {
      const result = success("✓");
      assert.strictEqual(result, "\x1b[32m✓\x1b[0m");
    });

    it("should handle empty string", () => {
      const result = success("");
      assert.strictEqual(result, "\x1b[32m\x1b[0m");
    });

    it("should apply green to custom success message", () => {
      const result = success("Success!");
      assert.strictEqual(result, "\x1b[32mSuccess!\x1b[0m");
    });
  });

  describe("error utility", () => {
    it("should apply red color with default x mark", () => {
      const result = error();
      assert.strictEqual(result, "\x1b[31m✗\x1b[0m");
    });

    it("should apply red color to custom text", () => {
      const result = error("FAIL");
      assert.strictEqual(result, "\x1b[31mFAIL\x1b[0m");
    });

    it("should apply red color to error symbol", () => {
      const result = error("✗");
      assert.strictEqual(result, "\x1b[31m✗\x1b[0m");
    });

    it("should handle empty string", () => {
      const result = error("");
      assert.strictEqual(result, "\x1b[31m\x1b[0m");
    });

    it("should apply red to custom error message", () => {
      const result = error("Error!");
      assert.strictEqual(result, "\x1b[31mError!\x1b[0m");
    });

    it("should apply red to X character", () => {
      const result = error("X");
      assert.strictEqual(result, "\x1b[31mX\x1b[0m");
    });
  });

  describe("success and error pairing", () => {
    it("should use different colors for success and error", () => {
      const successResult = success();
      const errorResult = error();

      assert.ok(successResult.includes("\x1b[32m")); // green
      assert.ok(errorResult.includes("\x1b[31m")); // red
    });

    it("should use different symbols for success and error", () => {
      const successResult = success();
      const errorResult = error();

      assert.ok(successResult.includes("✓"));
      assert.ok(errorResult.includes("✗"));
    });
  });
});
