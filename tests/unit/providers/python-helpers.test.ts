import { describe, test, expect } from "bun:test";
import {
  parseRequirementLine,
  parsePoetryLine,
} from "../../../src/providers/python";

describe("parseRequirementLine", () => {
  test("parses pinned version with ==", () => {
    const result = parseRequirementLine("requests==2.31.0");

    expect(result).toEqual(["requests", "==2.31.0"]);
  });

  test("parses minimum version with >=", () => {
    const result = parseRequirementLine("flask>=2.0.0");

    expect(result).toEqual(["flask", ">=2.0.0"]);
  });

  test("parses compatible version with ~=", () => {
    const result = parseRequirementLine("django~=4.2.0");

    expect(result).toEqual(["django", "~=4.2.0"]);
  });

  test("parses greater than with >", () => {
    const result = parseRequirementLine("numpy>1.24.0");

    expect(result).toEqual(["numpy", ">1.24.0"]);
  });

  test("parses less than with <", () => {
    const result = parseRequirementLine("pandas<2.0.0");

    expect(result).toEqual(["pandas", "<2.0.0"]);
  });

  test("parses less than or equal with <=", () => {
    const result = parseRequirementLine("scipy<=1.11.0");

    expect(result).toEqual(["scipy", "<=1.11.0"]);
  });

  test("returns null for comment lines", () => {
    expect(parseRequirementLine("# This is a comment")).toBeNull();
  });

  test("returns null for empty lines", () => {
    expect(parseRequirementLine("")).toBeNull();
  });

  test("returns null for whitespace-only lines", () => {
    expect(parseRequirementLine("   ")).toBeNull();
  });

  test("trims whitespace from line", () => {
    const result = parseRequirementLine("  requests==2.31.0  ");

    expect(result).toEqual(["requests", "==2.31.0"]);
  });

  test("returns null for lines without version specifier", () => {
    expect(parseRequirementLine("some-package-name")).toBeNull();
  });

  test("handles package names with hyphens", () => {
    const result = parseRequirementLine("my-cool-package==1.0.0");

    expect(result).toEqual(["my-cool-package", "==1.0.0"]);
  });

  test("handles package names with underscores", () => {
    const result = parseRequirementLine("my_package==1.0.0");

    expect(result).toEqual(["my_package", "==1.0.0"]);
  });
});

describe("parsePoetryLine", () => {
  test("parses standard poetry dependency", () => {
    const result = parsePoetryLine('requests = "^2.31.0"');

    expect(result).toEqual(["requests", "^2.31.0"]);
  });

  test("parses poetry dependency with tilde", () => {
    const result = parsePoetryLine('flask = "~2.0.0"');

    expect(result).toEqual(["flask", "~2.0.0"]);
  });

  test("parses poetry dependency with exact version", () => {
    const result = parsePoetryLine('django = "4.2.0"');

    expect(result).toEqual(["django", "4.2.0"]);
  });

  test("parses poetry dependency with >=", () => {
    const result = parsePoetryLine('numpy = ">=1.24.0"');

    expect(result).toEqual(["numpy", ">=1.24.0"]);
  });

  test("returns null for python dependency", () => {
    expect(parsePoetryLine('python = "^3.8"')).toBeNull();
  });

  test("returns null for empty line", () => {
    expect(parsePoetryLine("")).toBeNull();
  });

  test("returns null for non-matching line", () => {
    expect(parsePoetryLine("[tool.poetry]")).toBeNull();
  });

  test("returns null for section header", () => {
    expect(parsePoetryLine("[tool.poetry.dependencies]")).toBeNull();
  });

  test("handles whitespace in line", () => {
    const result = parsePoetryLine('  requests = "^2.31.0"  ');

    expect(result).toEqual(["requests", "^2.31.0"]);
  });

  test("handles package names with hyphens", () => {
    const result = parsePoetryLine('django-rest-framework = "^3.14.0"');

    expect(result).toEqual(["django-rest-framework", "^3.14.0"]);
  });
});
