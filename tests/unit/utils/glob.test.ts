import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { glob, sync } from "../../../src/utils/glob";

let testDir = "";

const writeFile = (path: string): void => {
  writeFileSync(join(testDir, path), "");
};

describe("glob", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "codependence-glob-"));
    mkdirSync(join(testDir, "src"), { recursive: true });
    mkdirSync(join(testDir, "dist"), { recursive: true });
    mkdirSync(join(testDir, "packages", "app"), { recursive: true });
    mkdirSync(join(testDir, "packages", "api"), { recursive: true });
    mkdirSync(join(testDir, "node_modules", "pkg"), { recursive: true });

    writeFile("file1.ts");
    writeFile("file2.ts");
    writeFile("src/index.ts");
    writeFile("dist/index.js");
    writeFile("package.json");
    writeFile("packages/app/package.json");
    writeFile("packages/api/package.json");
    writeFile("node_modules/pkg/package.json");
    writeFile("README.md");
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("finds files matching a root pattern", () => {
    const files = sync("*.ts", { cwd: testDir });

    expect(files).toEqual(["file1.ts", "file2.ts"]);
  });

  it("finds recursive matches including root files", () => {
    const files = sync("**/*.ts", { cwd: testDir });

    expect(files).toEqual(["file1.ts", "file2.ts", "src/index.ts"]);
  });

  it("keeps await glob compatibility", async () => {
    const files = await glob("**/*.ts", { cwd: testDir });

    expect(files).toEqual(["file1.ts", "file2.ts", "src/index.ts"]);
  });

  it("supports ignore patterns", () => {
    const files = sync("**/*.ts", {
      cwd: testDir,
      ignore: ["src/**"],
    });

    expect(files).toEqual(["file1.ts", "file2.ts"]);
  });

  it("supports multiple patterns", () => {
    const files = sync(["*.ts", "*.md"], { cwd: testDir });

    expect(files).toEqual(["README.md", "file1.ts", "file2.ts"]);
  });

  it("returns an empty array when no files match", () => {
    const files = sync("*.xyz", { cwd: testDir });

    expect(files).toEqual([]);
  });

  it("matches root files with recursive package patterns", () => {
    const files = sync("**/package.json", {
      cwd: testDir,
      ignore: ["**/node_modules/**"],
    });

    expect(files).toEqual([
      "package.json",
      "packages/api/package.json",
      "packages/app/package.json",
    ]);
  });

  it("matches direct workspace patterns", () => {
    const files = sync("packages/*/package.json", { cwd: testDir });

    expect(files).toEqual(["packages/api/package.json", "packages/app/package.json"]);
  });

  it("supports question mark patterns", () => {
    const files = sync("file?.ts", { cwd: testDir });

    expect(files).toEqual(["file1.ts", "file2.ts"]);
  });

  it("deduplicates overlapping patterns", () => {
    const files = sync(["package.json", "**/package.json"], {
      cwd: testDir,
      ignore: ["**/node_modules/**"],
    });

    expect(files).toEqual([
      "package.json",
      "packages/api/package.json",
      "packages/app/package.json",
    ]);
  });

  it("returns absolute paths when requested", () => {
    const files = sync("package.json", { cwd: testDir, absolute: true });

    expect(files).toEqual([resolve(testDir, "package.json")]);
  });

  it("supports absolute patterns", () => {
    const files = sync(resolve(testDir, "package.json"), {
      cwd: testDir,
      absolute: true,
    });

    expect(files).toEqual([resolve(testDir, "package.json")]);
  });

  it("returns an empty array for missing directories", () => {
    const files = sync("*.txt", { cwd: resolve(testDir, "missing") });

    expect(files).toEqual([]);
  });
});
