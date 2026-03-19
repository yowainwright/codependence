import { describe, test, expect } from "bun:test";
import { SYMBOLS, RAW_SYMBOLS } from "../../../src/utils/symbols";

const stripAnsi = (str: string): string =>
  str.replace(/\x1b\[[0-9;]*m/g, "");

describe("SYMBOLS", () => {
  test("success contains checkmark with ANSI color", () => {
    expect(stripAnsi(SYMBOLS.success)).toBe("✓");
    expect(SYMBOLS.success).toContain("\x1b[32m");
  });

  test("error contains cross with ANSI color", () => {
    expect(stripAnsi(SYMBOLS.error)).toBe("✗");
    expect(SYMBOLS.error).toContain("\x1b[31m");
  });

  test("warning contains triangle with ANSI color", () => {
    expect(stripAnsi(SYMBOLS.warning)).toBe("▲");
    expect(SYMBOLS.warning).toContain("\x1b[33m");
  });

  test("info contains diamond with ANSI color", () => {
    expect(stripAnsi(SYMBOLS.info)).toBe("◆");
    expect(SYMBOLS.info).toContain("\x1b[36m");
  });

  test("pinned contains square with ANSI color", () => {
    expect(stripAnsi(SYMBOLS.pinned)).toBe("■");
    expect(SYMBOLS.pinned).toContain("\x1b[33m");
  });

  test("severityMajor is red circle", () => {
    expect(stripAnsi(SYMBOLS.severityMajor)).toBe("●");
    expect(SYMBOLS.severityMajor).toContain("\x1b[31m");
  });

  test("severityMinor is yellow circle", () => {
    expect(stripAnsi(SYMBOLS.severityMinor)).toBe("●");
    expect(SYMBOLS.severityMinor).toContain("\x1b[33m");
  });

  test("severityPatch is green circle", () => {
    expect(stripAnsi(SYMBOLS.severityPatch)).toBe("●");
    expect(SYMBOLS.severityPatch).toContain("\x1b[32m");
  });

  test("arrow is cyan", () => {
    expect(stripAnsi(SYMBOLS.arrow)).toBe(">");
    expect(SYMBOLS.arrow).toContain("\x1b[36m");
  });

  test("dot is gray", () => {
    expect(stripAnsi(SYMBOLS.dot)).toBe("·");
    expect(SYMBOLS.dot).toContain("\x1b[90m");
  });

  test("bullet is gray", () => {
    expect(stripAnsi(SYMBOLS.bullet)).toBe(">");
    expect(SYMBOLS.bullet).toContain("\x1b[90m");
  });
});

describe("RAW_SYMBOLS", () => {
  test("contains plain characters without ANSI codes", () => {
    expect(RAW_SYMBOLS.success).toBe("✓");
    expect(RAW_SYMBOLS.error).toBe("✗");
    expect(RAW_SYMBOLS.warning).toBe("▲");
    expect(RAW_SYMBOLS.info).toBe("◆");
    expect(RAW_SYMBOLS.pinned).toBe("■");
    expect(RAW_SYMBOLS.severityMajor).toBe("●");
    expect(RAW_SYMBOLS.severityMinor).toBe("●");
    expect(RAW_SYMBOLS.severityPatch).toBe("●");
    expect(RAW_SYMBOLS.arrow).toBe(">");
    expect(RAW_SYMBOLS.bullet).toBe(">");
    expect(RAW_SYMBOLS.dot).toBe("·");
  });

  test("no ANSI codes in any raw symbol", () => {
    const values = Object.values(RAW_SYMBOLS);
    const hasAnsi = values.some((v) => v.includes("\x1b"));

    expect(hasAnsi).toBe(false);
  });
});
