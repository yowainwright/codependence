import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createAnsiPattern } from "../../../src/dx/constants";
import { RAW_SYMBOLS, SYMBOLS } from "../../../src/dx/report/constants";

const stripAnsi = (str: string): string => str.replace(createAnsiPattern(), "");

describe("SYMBOLS", () => {
  test("success contains checkmark with ANSI color", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.success), "✓");
    assert.ok(SYMBOLS.success.includes("\x1b[32m"));
  });

  test("error contains cross with ANSI color", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.error), "✗");
    assert.ok(SYMBOLS.error.includes("\x1b[31m"));
  });

  test("warning contains triangle with ANSI color", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.warning), "▲");
    assert.ok(SYMBOLS.warning.includes("\x1b[33m"));
  });

  test("info contains diamond with ANSI color", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.info), "◆");
    assert.ok(SYMBOLS.info.includes("\x1b[36m"));
  });

  test("pinned contains square with ANSI color", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.pinned), "■");
    assert.ok(SYMBOLS.pinned.includes("\x1b[33m"));
  });

  test("severityMajor is red circle", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.severityMajor), "●");
    assert.ok(SYMBOLS.severityMajor.includes("\x1b[31m"));
  });

  test("severityMinor is yellow circle", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.severityMinor), "●");
    assert.ok(SYMBOLS.severityMinor.includes("\x1b[33m"));
  });

  test("severityPatch is green circle", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.severityPatch), "●");
    assert.ok(SYMBOLS.severityPatch.includes("\x1b[32m"));
  });

  test("arrow is cyan", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.arrow), ">");
    assert.ok(SYMBOLS.arrow.includes("\x1b[36m"));
  });

  test("dot is gray", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.dot), "·");
    assert.ok(SYMBOLS.dot.includes("\x1b[90m"));
  });

  test("bullet is gray", () => {
    assert.strictEqual(stripAnsi(SYMBOLS.bullet), ">");
    assert.ok(SYMBOLS.bullet.includes("\x1b[90m"));
  });
});

describe("RAW_SYMBOLS", () => {
  test("contains plain characters without ANSI codes", () => {
    assert.strictEqual(RAW_SYMBOLS.success, "✓");
    assert.strictEqual(RAW_SYMBOLS.error, "✗");
    assert.strictEqual(RAW_SYMBOLS.warning, "▲");
    assert.strictEqual(RAW_SYMBOLS.info, "◆");
    assert.strictEqual(RAW_SYMBOLS.pinned, "■");
    assert.strictEqual(RAW_SYMBOLS.severityMajor, "●");
    assert.strictEqual(RAW_SYMBOLS.severityMinor, "●");
    assert.strictEqual(RAW_SYMBOLS.severityPatch, "●");
    assert.strictEqual(RAW_SYMBOLS.arrow, ">");
    assert.strictEqual(RAW_SYMBOLS.bullet, ">");
    assert.strictEqual(RAW_SYMBOLS.dot, "·");
  });

  test("no ANSI codes in any raw symbol", () => {
    const values = Object.values(RAW_SYMBOLS);
    const hasAnsi = values.some((v) => v.includes("\x1b"));

    assert.strictEqual(hasAnsi, false);
  });
});
