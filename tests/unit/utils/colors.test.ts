import { describe, it, expect } from "bun:test";
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
} from "../../../src/utils/colors";

describe("colors", () => {
  it("should apply green color", () => {
    const result = green("test");
    expect(result).toBe("\x1b[32mtest\x1b[0m");
  });

  it("should apply red color", () => {
    const result = red("error");
    expect(result).toBe("\x1b[31merror\x1b[0m");
  });

  it("should apply yellow color", () => {
    const result = yellow("warning");
    expect(result).toBe("\x1b[33mwarning\x1b[0m");
  });

  it("should apply cyan color", () => {
    const result = cyan("info");
    expect(result).toBe("\x1b[36minfo\x1b[0m");
  });

  it("should apply gray color", () => {
    const result = gray("debug");
    expect(result).toBe("\x1b[90mdebug\x1b[0m");
  });

  it("should apply bold style", () => {
    const result = bold("important");
    expect(result).toBe("\x1b[1mimportant\x1b[0m");
  });

  it("should apply gradient (bold cyan)", () => {
    const result = gradient("codependence");
    expect(result).toContain("\x1b[36m");
    expect(result).toContain("codependence");
  });

  it("should handle empty strings", () => {
    expect(green("")).toBe("\x1b[32m\x1b[0m");
    expect(red("")).toBe("\x1b[31m\x1b[0m");
  });

  describe("success utility", () => {
    it("should apply green color with default checkmark", () => {
      const result = success();
      expect(result).toBe("\x1b[32m✓\x1b[0m");
    });

    it("should apply green color to custom text", () => {
      const result = success("PASS");
      expect(result).toBe("\x1b[32mPASS\x1b[0m");
    });

    it("should apply green color to success symbol", () => {
      const result = success("✓");
      expect(result).toBe("\x1b[32m✓\x1b[0m");
    });

    it("should handle empty string", () => {
      const result = success("");
      expect(result).toBe("\x1b[32m\x1b[0m");
    });

    it("should apply green to custom success message", () => {
      const result = success("Success!");
      expect(result).toBe("\x1b[32mSuccess!\x1b[0m");
    });
  });

  describe("error utility", () => {
    it("should apply red color with default x mark", () => {
      const result = error();
      expect(result).toBe("\x1b[31m✗\x1b[0m");
    });

    it("should apply red color to custom text", () => {
      const result = error("FAIL");
      expect(result).toBe("\x1b[31mFAIL\x1b[0m");
    });

    it("should apply red color to error symbol", () => {
      const result = error("✗");
      expect(result).toBe("\x1b[31m✗\x1b[0m");
    });

    it("should handle empty string", () => {
      const result = error("");
      expect(result).toBe("\x1b[31m\x1b[0m");
    });

    it("should apply red to custom error message", () => {
      const result = error("Error!");
      expect(result).toBe("\x1b[31mError!\x1b[0m");
    });

    it("should apply red to X character", () => {
      const result = error("X");
      expect(result).toBe("\x1b[31mX\x1b[0m");
    });
  });

  describe("success and error pairing", () => {
    it("should use different colors for success and error", () => {
      const successResult = success();
      const errorResult = error();

      expect(successResult).toContain("\x1b[32m"); // green
      expect(errorResult).toContain("\x1b[31m"); // red
    });

    it("should use different symbols for success and error", () => {
      const successResult = success();
      const errorResult = error();

      expect(successResult).toContain("✓");
      expect(errorResult).toContain("✗");
    });
  });
});
