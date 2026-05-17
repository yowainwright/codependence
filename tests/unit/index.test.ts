import { describe, expect, test } from "bun:test";
import * as entry from "../../src";

describe("package entry", () => {
  test("exports the public API without running the CLI", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "checkFiles",
      "codependence",
      "default",
      "script",
    ]);
    expect(typeof entry.checkFiles).toBe("function");
    expect(typeof entry.codependence).toBe("function");
    expect(typeof entry.script).toBe("function");
    expect(entry.default).toBe(entry.codependence);
  });
});
