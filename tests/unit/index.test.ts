import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import * as entry from "../../src";

const readPackage = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Record<string, unknown>;

describe("package entry", () => {
  test("exports the public API without running the CLI", () => {
    expect(Object.keys(entry).sort()).toEqual(["checkFiles", "codependence", "default", "script"]);
    expect(typeof entry.checkFiles).toBe("function");
    expect(typeof entry.codependence).toBe("function");
    expect(typeof entry.script).toBe("function");
    expect(entry.default).toBe(entry.codependence);
  });

  test("keeps runtime dependencies out of the published package", () => {
    const rootPackage = readPackage("../../package.json");
    const sitePackage = readPackage("../../page/app/package.json");
    const siteDependencies = sitePackage.dependencies as Record<string, string>;

    expect(rootPackage.dependencies).toBeUndefined();
    expect(siteDependencies.effect).toBe("^3.22.1");
  });
});
