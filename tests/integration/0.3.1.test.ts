import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as entry from "../../src";
import { parseArgs } from "../../src/cli/parser";
import { loadConfig } from "../../src/config";

const fixtureRoot = join(process.cwd(), "tests/fixtures/0.3.1");

describe("0.3.1 compatibility", () => {
  test("keeps the legacy CLI flags", () => {
    const parsed = parseArgs([
      "node",
      "codependence",
      "-t",
      "--isTesting",
      "-f",
      "package.json",
      "-u",
      "-r",
      "./",
      "-i",
      "**/vendor/**",
      "--debug",
      "--silent",
      "-cds",
      "lodash",
      "-c",
      "policy.json",
      "-s",
      "./config",
      "-y",
    ]);

    expect(parsed.options).toEqual({
      isTestingCLI: true,
      isTesting: true,
      files: ["package.json"],
      update: true,
      rootDir: "./",
      ignore: ["**/vendor/**"],
      debug: true,
      silent: true,
      codependencies: ["lodash"],
      config: "policy.json",
      searchPath: "./config",
      yarnConfig: true,
    });
  });

  test("keeps the legacy package entry and binary names", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

    expect(typeof entry.script).toBe("function");
    expect(packageJson.bin).toEqual({
      codependence: "dist/cli.js",
      cdp: "dist/cli.js",
    });
    expect(packageJson.exports["."].import).toBe("./dist/index.js");
    expect(packageJson.exports["."].require).toBe("./dist/index.cjs");
  });

  test("loads embedded package.json policy", () => {
    const result = loadConfig(join(fixtureRoot, "package.json"));

    expect(result?.config).toEqual({
      codependencies: [{ lodash: "4.17.21" }],
    });
  });

  test("keeps the legacy script non-throwing", async () => {
    const result = await entry.script({
      codependencies: [{ lodash: "4.18.0" }],
      rootDir: fixtureRoot,
      files: ["package.json"],
      silent: true,
    });

    expect(result).toBeUndefined();
  });
});
