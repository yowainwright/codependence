import { describe, test, expect, spyOn } from "bun:test";
import { parseArgs, showHelp } from "../../src/cli/parser";

describe("parseArgs", () => {
  const baseArgs = ["node", "script.js"];

  test("should parse boolean flags", () => {
    const args = [...baseArgs, "--update"];
    const result = parseArgs(args);

    expect(result.options.update).toBe(true);
    expect(result.command).toBeUndefined();
  });

  test("should parse short boolean flags", () => {
    const args = [...baseArgs, "-u"];
    const result = parseArgs(args);

    expect(result.options.update).toBe(true);
  });

  test("should parse flags with values", () => {
    const args = [...baseArgs, "--config", "/path/to/config"];
    const result = parseArgs(args);

    expect(result.options.config).toBe("/path/to/config");
  });

  test("should parse short flags with values", () => {
    const args = [...baseArgs, "-c", "/path/to/config"];
    const result = parseArgs(args);

    expect(result.options.config).toBe("/path/to/config");
  });

  test("should parse flags with inline values", () => {
    const args = [...baseArgs, "--config=/path/to/config"];
    const result = parseArgs(args);

    expect(result.options.config).toBe("/path/to/config");
  });

  test("should parse array flags", () => {
    const args = [...baseArgs, "--files", "a.js", "b.js", "c.js"];
    const result = parseArgs(args);

    expect(result.options.files).toEqual(["a.js", "b.js", "c.js"]);
  });

  test("should parse short array flags", () => {
    const args = [...baseArgs, "-f", "a.js", "b.js"];
    const result = parseArgs(args);

    expect(result.options.files).toEqual(["a.js", "b.js"]);
  });

  test("should parse array flags followed by another flag", () => {
    const args = [...baseArgs, "--files", "a.js", "b.js", "--update"];
    const result = parseArgs(args);

    expect(result.options.files).toEqual(["a.js", "b.js"]);
    expect(result.options.update).toBe(true);
  });

  test("should handle empty array flags", () => {
    const args = [...baseArgs, "--files", "--update"];
    const result = parseArgs(args);

    expect(result.options.files).toBeUndefined();
    expect(result.options.update).toBe(true);
  });

  test("should parse commands", () => {
    const args = [...baseArgs, "init"];
    const result = parseArgs(args);

    expect(result.command).toBe("init");
  });

  test("should parse commands with flags", () => {
    const args = [...baseArgs, "init", "--verbose"];
    const result = parseArgs(args);

    expect(result.command).toBe("init");
    expect(result.options.verbose).toBe(true);
  });

  test("should ignore unknown flags", () => {
    const args = [...baseArgs, "--unknown-flag"];
    const result = parseArgs(args);

    expect(result.options.unknownFlag).toBeUndefined();
  });

  test("should parse multiple boolean flags", () => {
    const args = [...baseArgs, "--update", "--verbose", "--debug"];
    const result = parseArgs(args);

    expect(result.options.update).toBe(true);
    expect(result.options.verbose).toBe(true);
    expect(result.options.debug).toBe(true);
  });

  test("should parse mixed flags and values", () => {
    const args = [
      ...baseArgs,
      "--update",
      "--config",
      "path",
      "-f",
      "a.js",
      "b.js",
      "--verbose",
    ];
    const result = parseArgs(args);

    expect(result.options.update).toBe(true);
    expect(result.options.config).toBe("path");
    expect(result.options.files).toEqual(["a.js", "b.js"]);
    expect(result.options.verbose).toBe(true);
  });

  test("should handle --help flag", () => {
    const args = [...baseArgs, "--help"];
    const result = parseArgs(args);

    expect(result.options.help).toBe(true);
  });

  test("should handle short help flag", () => {
    const args = [...baseArgs, "-h"];
    const result = parseArgs(args);

    expect(result.options.help).toBe(true);
  });

  test("should convert kebab-case to camelCase", () => {
    const args = [...baseArgs, "--dry-run"];
    const result = parseArgs(args);

    expect(result.options.dryRun).toBe(true);
  });

  test("should handle --no-cache flag", () => {
    const args = [...baseArgs, "--no-cache"];
    const result = parseArgs(args);

    expect(result.options.noCache).toBe(true);
  });

  test("should handle --interactive flag", () => {
    const args = [...baseArgs, "--interactive"];
    const result = parseArgs(args);

    expect(result.options.interactive).toBe(true);
  });

  test("should handle --watch flag", () => {
    const args = [...baseArgs, "--watch"];
    const result = parseArgs(args);

    expect(result.options.watch).toBe(true);
  });

  test("should handle --codependencies with multiple values", () => {
    const args = [
      ...baseArgs,
      "--codependencies",
      "lodash",
      "express",
      "react",
    ];
    const result = parseArgs(args);

    expect(result.options.cds).toEqual(["lodash", "express", "react"]);
  });

  test("should handle --cds shorthand", () => {
    const args = [...baseArgs, "--cds", "lodash"];
    const result = parseArgs(args);

    expect(result.options.cds).toEqual(["lodash"]);
  });

  test("should handle --ignore with multiple patterns", () => {
    const args = [...baseArgs, "--ignore", "**/node_modules/**", "**/dist/**"];
    const result = parseArgs(args);

    expect(result.options.ignore).toEqual(["**/node_modules/**", "**/dist/**"]);
  });

  test("should handle short ignore flag", () => {
    const args = [...baseArgs, "-i", "pattern"];
    const result = parseArgs(args);

    expect(result.options.ignore).toEqual(["pattern"]);
  });

  test("should handle --rootDir", () => {
    const args = [...baseArgs, "--rootDir", "/path/to/root"];
    const result = parseArgs(args);

    expect(result.options.rootDir).toBe("/path/to/root");
  });

  test("should handle short rootDir flag", () => {
    const args = [...baseArgs, "-r", "/path"];
    const result = parseArgs(args);

    expect(result.options.rootDir).toBe("/path");
  });

  test("should handle --searchPath", () => {
    const args = [...baseArgs, "--searchPath", "/search/path"];
    const result = parseArgs(args);

    expect(result.options.searchPath).toBe("/search/path");
  });

  test("should handle --yarnConfig flag", () => {
    const args = [...baseArgs, "--yarnConfig"];
    const result = parseArgs(args);

    expect(result.options.yarnConfig).toBe(true);
  });

  test("should handle --permissive flag", () => {
    const args = [...baseArgs, "--permissive"];
    const result = parseArgs(args);

    expect(result.options.permissive).toBe(true);
  });

  test("should handle --language", () => {
    const args = [...baseArgs, "--language", "go"];
    const result = parseArgs(args);

    expect(result.options.language).toBe("go");
  });

  test("should handle --silent flag", () => {
    const args = [...baseArgs, "--silent"];
    const result = parseArgs(args);

    expect(result.options.silent).toBe(true);
  });

  test("should handle --quiet flag", () => {
    const args = [...baseArgs, "--quiet"];
    const result = parseArgs(args);

    expect(result.options.quiet).toBe(true);
  });

  test("should handle --isTestingCLI flag", () => {
    const args = [...baseArgs, "--isTestingCLI"];
    const result = parseArgs(args);

    expect(result.options.isTestingCLI).toBe(true);
  });

  test("should handle --isTesting flag", () => {
    const args = [...baseArgs, "--isTesting"];
    const result = parseArgs(args);

    expect(result.options.isTesting).toBe(true);
  });

  test("should handle complex real-world example", () => {
    const args = [
      ...baseArgs,
      "--update",
      "--dry-run",
      "--interactive",
      "--files",
      "packages/*/package.json",
      "--ignore",
      "**/node_modules/**",
      "--codependencies",
      "lodash",
      "express",
      "--verbose",
    ];
    const result = parseArgs(args);

    expect(result.options.update).toBe(true);
    expect(result.options.dryRun).toBe(true);
    expect(result.options.interactive).toBe(true);
    expect(result.options.files).toEqual(["packages/*/package.json"]);
    expect(result.options.ignore).toEqual(["**/node_modules/**"]);
    expect(result.options.cds).toEqual(["lodash", "express"]);
    expect(result.options.verbose).toBe(true);
  });

  test("should handle init command with type", () => {
    const args = [...baseArgs, "init", "rc"];
    const result = parseArgs(args);

    expect(result.command).toBe("rc");
  });

  test("should handle empty args", () => {
    const args = [...baseArgs];
    const result = parseArgs(args);

    expect(result.command).toBeUndefined();
    expect(Object.keys(result.options).length).toBeGreaterThanOrEqual(0);
  });

  test("should handle flags with values that start with dash in inline format", () => {
    const args = [...baseArgs, "--config=-some-value"];
    const result = parseArgs(args);

    expect(result.options.config).toBe("-some-value");
  });

  test("should parse value flags without value as true", () => {
    const args = [...baseArgs, "--config"];
    const result = parseArgs(args);

    expect(result.options.config).toBe(true);
  });
});

describe("showHelp", () => {
  test("should display help text", () => {
    const consoleSpy = spyOn(console, "log");
    showHelp();

    expect(consoleSpy).toHaveBeenCalled();
    const callArg = consoleSpy.mock.calls[0][0] as string;
    expect(callArg).toContain("Codependence");
    expect(callArg).toContain("Usage:");
    expect(callArg).toContain("Commands:");
    expect(callArg).toContain("Options:");

    consoleSpy.mockRestore();
  });

  test("should include all new options in help text", () => {
    const consoleSpy = spyOn(console, "log");
    showHelp();

    const callArg = consoleSpy.mock.calls[0][0] as string;
    expect(callArg).toContain("--dry-run");
    expect(callArg).toContain("--interactive");
    expect(callArg).toContain("--watch");
    expect(callArg).toContain("--no-cache");

    consoleSpy.mockRestore();
  });
});
