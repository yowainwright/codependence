import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCondaDependencyLine,
  parseRequirementLine,
  parsePoetryLine,
} from "../../../../src/providers/python";

describe("parseRequirementLine", () => {
  test("parses pinned version with ==", () => {
    const result = parseRequirementLine("requests==2.31.0");

    assert.deepStrictEqual(result, ["requests", "==2.31.0"]);
  });

  test("parses minimum version with >=", () => {
    const result = parseRequirementLine("flask>=2.0.0");

    assert.deepStrictEqual(result, ["flask", ">=2.0.0"]);
  });

  test("parses compatible version with ~=", () => {
    const result = parseRequirementLine("django~=4.2.0");

    assert.deepStrictEqual(result, ["django", "~=4.2.0"]);
  });

  test("parses greater than with >", () => {
    const result = parseRequirementLine("numpy>1.24.0");

    assert.deepStrictEqual(result, ["numpy", ">1.24.0"]);
  });

  test("parses less than with <", () => {
    const result = parseRequirementLine("pandas<2.0.0");

    assert.deepStrictEqual(result, ["pandas", "<2.0.0"]);
  });

  test("parses less than or equal with <=", () => {
    const result = parseRequirementLine("scipy<=1.11.0");

    assert.deepStrictEqual(result, ["scipy", "<=1.11.0"]);
  });

  test("parses extras as the base package", () => {
    const result = parseRequirementLine("requests[security]>=2.31.0");

    assert.deepStrictEqual(result, ["requests", ">=2.31.0"]);
  });

  test("returns null for comment lines", () => {
    assert.strictEqual(parseRequirementLine("# This is a comment"), null);
  });

  test("returns null for empty lines", () => {
    assert.strictEqual(parseRequirementLine(""), null);
  });

  test("returns null for whitespace-only lines", () => {
    assert.strictEqual(parseRequirementLine("   "), null);
  });

  test("trims whitespace from line", () => {
    const result = parseRequirementLine("  requests==2.31.0  ");

    assert.deepStrictEqual(result, ["requests", "==2.31.0"]);
  });

  test("returns null for lines without version specifier", () => {
    assert.strictEqual(parseRequirementLine("some-package-name"), null);
  });

  test("handles package names with hyphens", () => {
    const result = parseRequirementLine("my-cool-package==1.0.0");

    assert.deepStrictEqual(result, ["my-cool-package", "==1.0.0"]);
  });

  test("handles package names with underscores", () => {
    const result = parseRequirementLine("my_package==1.0.0");

    assert.deepStrictEqual(result, ["my_package", "==1.0.0"]);
  });
});

describe("parseCondaDependencyLine", () => {
  test("parses conda exact dependency", () => {
    const result = parseCondaDependencyLine("  - numpy=1.24.0");

    assert.deepStrictEqual(result, ["numpy", "=1.24.0"]);
  });

  test("parses conda comparison dependency", () => {
    const result = parseCondaDependencyLine("  - pandas>=2.0.0");

    assert.deepStrictEqual(result, ["pandas", ">=2.0.0"]);
  });

  test("ignores python runtime dependency", () => {
    assert.strictEqual(parseCondaDependencyLine("  - python=3.11"), null);
  });

  test("ignores nested pip group header", () => {
    assert.strictEqual(parseCondaDependencyLine("  - pip:"), null);
  });
});

describe("parsePoetryLine", () => {
  test("parses standard poetry dependency", () => {
    const result = parsePoetryLine('requests = "^2.31.0"');

    assert.deepStrictEqual(result, ["requests", "^2.31.0"]);
  });

  test("parses poetry dependency with tilde", () => {
    const result = parsePoetryLine('flask = "~2.0.0"');

    assert.deepStrictEqual(result, ["flask", "~2.0.0"]);
  });

  test("parses poetry dependency with exact version", () => {
    const result = parsePoetryLine('django = "4.2.0"');

    assert.deepStrictEqual(result, ["django", "4.2.0"]);
  });

  test("parses poetry dependency with >=", () => {
    const result = parsePoetryLine('numpy = ">=1.24.0"');

    assert.deepStrictEqual(result, ["numpy", ">=1.24.0"]);
  });

  test("returns null for python dependency", () => {
    assert.strictEqual(parsePoetryLine('python = "^3.8"'), null);
  });

  test("returns null for empty line", () => {
    assert.strictEqual(parsePoetryLine(""), null);
  });

  test("returns null for non-matching line", () => {
    assert.strictEqual(parsePoetryLine("[tool.poetry]"), null);
  });

  test("returns null for section header", () => {
    assert.strictEqual(parsePoetryLine("[tool.poetry.dependencies]"), null);
  });

  test("handles whitespace in line", () => {
    const result = parsePoetryLine('  requests = "^2.31.0"  ');

    assert.deepStrictEqual(result, ["requests", "^2.31.0"]);
  });

  test("handles package names with hyphens", () => {
    const result = parsePoetryLine('django-rest-framework = "^3.14.0"');

    assert.deepStrictEqual(result, ["django-rest-framework", "^3.14.0"]);
  });
});
