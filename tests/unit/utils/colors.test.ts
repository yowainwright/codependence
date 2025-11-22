import { describe, it, expect } from "bun:test";
import {
  green,
  red,
  yellow,
  cyan,
  gray,
  bold,
  gradient,
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
});
