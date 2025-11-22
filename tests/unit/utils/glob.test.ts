import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { glob } from "../../../src/utils/glob";

const testDir = join(process.cwd(), "test-glob-temp");

describe("glob", () => {
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, "src"), { recursive: true });
    mkdirSync(join(testDir, "dist"), { recursive: true });
    writeFileSync(join(testDir, "file1.ts"), "");
    writeFileSync(join(testDir, "file2.ts"), "");
    writeFileSync(join(testDir, "src", "index.ts"), "");
    writeFileSync(join(testDir, "dist", "index.js"), "");
    writeFileSync(join(testDir, "README.md"), "");
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should find files matching pattern", async () => {
    const files = await glob("*.ts", { cwd: testDir });
    expect(files).toContain("file1.ts");
    expect(files).toContain("file2.ts");
    expect(files.length).toBe(2);
  });

  it("should find files recursively", async () => {
    const files = await glob("**/*.ts", { cwd: testDir });
    expect(files).toContain("file1.ts");
    expect(files).toContain("file2.ts");
    expect(files).toContain("src/index.ts");
    expect(files.length).toBe(3);
  });

  it("should support ignore patterns", async () => {
    const files = await glob("**/*.ts", {
      cwd: testDir,
      ignore: ["src/**"],
    });
    expect(files).toContain("file1.ts");
    expect(files).toContain("file2.ts");
    expect(files).not.toContain("src/index.ts");
  });

  it("should support multiple patterns", async () => {
    const files = await glob(["*.ts", "*.md"], { cwd: testDir });
    expect(files).toContain("file1.ts");
    expect(files).toContain("file2.ts");
    expect(files).toContain("README.md");
  });

  it("should return sorted results", async () => {
    const files = await glob("*.ts", { cwd: testDir });
    expect(files[0]).toBe("file1.ts");
    expect(files[1]).toBe("file2.ts");
  });

  it("should return empty array when no matches", async () => {
    const files = await glob("*.xyz", { cwd: testDir });
    expect(files).toEqual([]);
  });
});
