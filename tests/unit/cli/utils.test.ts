import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, showHelp } from "../../../src/cli/utils";

describe("parseArgs", () => {
  const baseArgs = ["node", "script.js"];

  test("should parse boolean flags", () => {
    const args = [...baseArgs, "--update"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.update, true);
    assert.strictEqual(result.command, undefined);
  });

  test("should parse short boolean flags", () => {
    const args = [...baseArgs, "-u"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.update, true);
  });

  test("should parse flags with values", () => {
    const args = [...baseArgs, "--config", "/path/to/config"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.config, "/path/to/config");
  });

  test("should parse short flags with values", () => {
    const args = [...baseArgs, "-c", "/path/to/config"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.config, "/path/to/config");
  });

  test("should parse flags with inline values", () => {
    const args = [...baseArgs, "--config=/path/to/config"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.config, "/path/to/config");
  });

  test("should parse array flags", () => {
    const args = [...baseArgs, "--files", "a.js", "b.js", "c.js"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.files, ["a.js", "b.js", "c.js"]);
  });

  test("should parse selected target managers", () => {
    const args = [...baseArgs, "--target", "bun", "go"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.target, ["bun", "go"]);
  });

  test("should parse init actions options", () => {
    const args = [
      ...baseArgs,
      "init",
      "actions",
      "--version",
      "bun=1.3.14",
      "go=1.26.4",
      "--schedule",
      "go=0 9 * * 3",
      "--post-update-command",
      "go=go mod tidy",
      "--force",
    ];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.version, ["bun=1.3.14", "go=1.26.4"]);
    assert.deepStrictEqual(result.options.schedule, ["go=0 9 * * 3"]);
    assert.deepStrictEqual(result.options.postUpdateCommand, ["go=go mod tidy"]);
    assert.strictEqual(result.options.force, true);
  });

  test("should parse init actions target, credential, and root options", () => {
    const args = [
      ...baseArgs,
      "init",
      "actions",
      "--target",
      "go",
      "--token-secret",
      "DEPENDENCY_UPDATES",
      "--rootDir",
      "/workspace",
    ];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.target, ["go"]);
    assert.strictEqual(result.options.tokenSecret, "DEPENDENCY_UPDATES");
    assert.strictEqual(result.options.rootDir, "/workspace");
  });

  test("should parse inline init actions values", () => {
    const args = [
      ...baseArgs,
      "init",
      "actions",
      "--version=go=1.26.4",
      "--schedule=go=0 9 * * 3",
      "--post-update-command=go=go mod tidy",
    ];
    const result = parseArgs(args);

    assert.strictEqual(result.options.version, "go=1.26.4");
    assert.strictEqual(result.options.schedule, "go=0 9 * * 3");
    assert.strictEqual(result.options.postUpdateCommand, "go=go mod tidy");
  });

  test("should parse non-interactive onboarding options", () => {
    const args = [
      ...baseArgs,
      "onboard",
      "--mode",
      "precise",
      "--codependencies",
      "react",
      "--enforcement",
      "both",
      "--repository",
      "acme/workspace",
      "--non-interactive",
      "--skip-install",
    ];
    const result = parseArgs(args);

    assert.strictEqual(result.command, "onboard");
    assert.strictEqual(result.options.enforcement, "both");
    assert.strictEqual(result.options.repository, "acme/workspace");
    assert.strictEqual(result.options.nonInteractive, true);
    assert.strictEqual(result.options.skipInstall, true);
  });

  test("should parse lockfile enforcement", () => {
    const required = parseArgs([...baseArgs, "--lockfile"]);
    const disabled = parseArgs([...baseArgs, "--lockfile=false"]);

    assert.strictEqual(required.options.lockfile, true);
    assert.strictEqual(disabled.options.lockfile, false);
  });

  test("should parse short array flags", () => {
    const args = [...baseArgs, "-f", "a.js", "b.js"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.files, ["a.js", "b.js"]);
  });

  test("should parse array flags followed by another flag", () => {
    const args = [...baseArgs, "--files", "a.js", "b.js", "--update"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.files, ["a.js", "b.js"]);
    assert.strictEqual(result.options.update, true);
  });

  test("should handle empty array flags", () => {
    const args = [...baseArgs, "--files", "--update"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.files, undefined);
    assert.strictEqual(result.options.update, true);
  });

  test("should parse commands", () => {
    const args = [...baseArgs, "init"];
    const result = parseArgs(args);

    assert.strictEqual(result.command, "init");
  });

  test("should parse commands with flags", () => {
    const args = [...baseArgs, "init", "--verbose"];
    const result = parseArgs(args);

    assert.strictEqual(result.command, "init");
    assert.strictEqual(result.options.verbose, true);
  });

  test("should ignore unknown flags", () => {
    const args = [...baseArgs, "--unknown-flag"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.unknownFlag, undefined);
  });

  test("should parse multiple boolean flags", () => {
    const args = [...baseArgs, "--update", "--verbose", "--debug"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.update, true);
    assert.strictEqual(result.options.verbose, true);
    assert.strictEqual(result.options.debug, true);
  });

  test("should parse mixed flags and values", () => {
    const args = [...baseArgs, "--update", "--config", "path", "-f", "a.js", "b.js", "--verbose"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.update, true);
    assert.strictEqual(result.options.config, "path");
    assert.deepStrictEqual(result.options.files, ["a.js", "b.js"]);
    assert.strictEqual(result.options.verbose, true);
  });

  test("should handle --help flag", () => {
    const args = [...baseArgs, "--help"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.help, true);
  });

  test("should handle short help flag", () => {
    const args = [...baseArgs, "-h"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.help, true);
  });

  test("should convert kebab-case to camelCase", () => {
    const args = [...baseArgs, "--dry-run"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.dryRun, true);
  });

  test("should handle --no-cache flag", () => {
    const args = [...baseArgs, "--no-cache"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.noCache, true);
  });

  test("should handle --interactive flag", () => {
    const args = [...baseArgs, "--interactive"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.interactive, true);
  });

  test("should handle --watch flag", () => {
    const args = [...baseArgs, "--watch"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.watch, true);
  });

  test("should handle --codependencies with multiple values", () => {
    const args = [...baseArgs, "--codependencies", "lodash", "express", "react"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.codependencies, ["lodash", "express", "react"]);
  });

  test("should handle --cds shorthand", () => {
    const args = [...baseArgs, "--cds", "lodash"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.codependencies, ["lodash"]);
  });

  test("should handle legacy -cds shorthand", () => {
    const args = [...baseArgs, "-cds", "lodash"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.codependencies, ["lodash"]);
  });

  test("should handle --ignore with multiple patterns", () => {
    const args = [...baseArgs, "--ignore", "**/node_modules/**", "**/dist/**"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.ignore, ["**/node_modules/**", "**/dist/**"]);
  });

  test("should handle short ignore flag", () => {
    const args = [...baseArgs, "-i", "pattern"];
    const result = parseArgs(args);

    assert.deepStrictEqual(result.options.ignore, ["pattern"]);
  });

  test("should handle --rootDir", () => {
    const args = [...baseArgs, "--rootDir", "/path/to/root"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.rootDir, "/path/to/root");
  });

  test("should handle short rootDir flag", () => {
    const args = [...baseArgs, "-r", "/path"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.rootDir, "/path");
  });

  test("should handle --searchPath", () => {
    const args = [...baseArgs, "--searchPath", "/search/path"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.searchPath, "/search/path");
  });

  test("should handle --yarnConfig flag", () => {
    const args = [...baseArgs, "--yarnConfig"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.yarnConfig, true);
  });

  test("should handle --permissive flag", () => {
    const args = [...baseArgs, "--permissive"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.permissive, true);
  });

  test("should handle --language", () => {
    const args = [...baseArgs, "--language", "go"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.language, "go");
  });

  test("should handle --silent flag", () => {
    const args = [...baseArgs, "--silent"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.silent, true);
  });

  test("should handle --quiet flag", () => {
    const args = [...baseArgs, "--quiet"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.quiet, true);
  });

  test("should handle --isTestingCLI flag", () => {
    const args = [...baseArgs, "--isTestingCLI"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.isTestingCLI, true);
  });

  test("should handle --isTesting flag", () => {
    const args = [...baseArgs, "--isTesting"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.isTesting, true);
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

    assert.strictEqual(result.options.update, true);
    assert.strictEqual(result.options.dryRun, true);
    assert.strictEqual(result.options.interactive, true);
    assert.deepStrictEqual(result.options.files, ["packages/*/package.json"]);
    assert.deepStrictEqual(result.options.ignore, ["**/node_modules/**"]);
    assert.deepStrictEqual(result.options.codependencies, ["lodash", "express"]);
    assert.strictEqual(result.options.verbose, true);
  });

  test("should handle init command with type", () => {
    const args = [...baseArgs, "init", "rc"];
    const result = parseArgs(args);

    assert.strictEqual(result.command, "rc");
  });

  test("should handle empty args", () => {
    const args = [...baseArgs];
    const result = parseArgs(args);

    assert.strictEqual(result.command, undefined);
    assert.ok(Object.keys(result.options).length >= 0);
  });

  test("should handle flags with values that start with dash in inline format", () => {
    const args = [...baseArgs, "--config=-some-value"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.config, "-some-value");
  });

  test("should parse value flags without value as true", () => {
    const args = [...baseArgs, "--config"];
    const result = parseArgs(args);

    assert.strictEqual(result.options.config, true);
  });
});

describe("showHelp", () => {
  test("should display help text", () => {
    const consoleSpy = mock.method(console, "log");
    showHelp();

    assert.ok(consoleSpy.mock.callCount() > 0);
    const callArg = consoleSpy.mock.calls[0].arguments[0] as string;
    assert.ok(callArg.includes("Codependence"));
    assert.ok(callArg.includes("Usage:"));
    assert.ok(callArg.includes("Commands:"));
    assert.ok(callArg.includes("Options:"));

    consoleSpy.mock.restore();
  });

  test("should include all new options in help text", () => {
    const consoleSpy = mock.method(console, "log");
    showHelp();

    const callArg = consoleSpy.mock.calls[0].arguments[0] as string;
    assert.ok(callArg.includes("--dryRun"));
    assert.ok(callArg.includes("--interactive"));
    assert.ok(callArg.includes("--watch"));
    assert.ok(callArg.includes("--noCache"));

    consoleSpy.mock.restore();
  });
});
