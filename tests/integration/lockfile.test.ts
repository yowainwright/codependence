import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFiles } from "../../src/scripts";

const workspaces: string[] = [];

const createWorkspace = (file: string, content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "codependence-lockfile-"));
  workspaces.push(root);
  writeFileSync(join(root, file), content);
  return root;
};

const nodeManifest = JSON.stringify({
  name: "fixture",
  version: "1.0.0",
  dependencies: { lodash: "4.17.20" },
});

afterEach(() => {
  workspaces.splice(0).forEach((root) => rmSync(root, { force: true, recursive: true }));
});

describe("lockfiles", () => {
  test("requires the selected Node manager lockfile", async () => {
    const root = createWorkspace("package.json", nodeManifest);

    const update = checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      files: ["package.json"],
      language: "nodejs",
      lockfile: true,
      mode: "verbose",
      packageManager: "bun",
      rootDir: root,
      silent: true,
      update: true,
    });

    await expect(update).rejects.toThrow("bun.lock");
  });

  test("requires every configured lockfile", async () => {
    const root = createWorkspace("package.json", nodeManifest);

    const update = checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      files: ["package.json"],
      language: "nodejs",
      lockfile: ["bun.lock", "generated/dependencies.lock"],
      mode: "verbose",
      packageManager: "bun",
      rootDir: root,
      silent: true,
      update: true,
    });

    await expect(update).rejects.toThrow("generated/dependencies.lock");
  });

  test("requires uv.lock for a managed uv project", async () => {
    const content = [
      '[project]',
      'name = "fixture"',
      'version = "1.0.0"',
      'dependencies = ["requests==2.31.0"]',
      '',
    ].join("\n");
    const root = createWorkspace("pyproject.toml", content);

    const update = checkFiles({
      codependencies: [{ requests: "==2.32.0" }],
      files: ["pyproject.toml"],
      language: "python",
      lockfile: true,
      mode: "verbose",
      packageManager: "uv",
      rootDir: root,
      silent: true,
      update: true,
    });

    await expect(update).rejects.toThrow("uv.lock");
  });

  test("fails before editing a managed Go module without go.sum", async () => {
    const original = [
      "module example.com/service",
      "",
      "go 1.26.1",
      "",
      "require github.com/google/uuid v1.5.0",
      "",
    ].join("\n");
    const root = createWorkspace("go.mod", original);

    const update = checkFiles({
      codependencies: [{ "github.com/google/uuid": "v1.6.0" }],
      files: ["go.mod"],
      language: "go",
      lockfile: true,
      mode: "verbose",
      rootDir: root,
      silent: true,
      update: true,
    });

    await expect(update).rejects.toThrow("go.sum");
    expect(readFileSync(join(root, "go.mod"), "utf8")).toBe(original);
  });

  test("allows an explicit manifest-only Go update", async () => {
    const original = [
      "module example.com/service",
      "",
      "go 1.26.1",
      "",
      "require github.com/google/uuid v1.5.0",
      "",
    ].join("\n");
    const root = createWorkspace("go.mod", original);

    await checkFiles({
      codependencies: [{ "github.com/google/uuid": "v1.6.0" }],
      files: ["go.mod"],
      language: "go",
      lockfile: false,
      mode: "verbose",
      rootDir: root,
      silent: true,
      update: true,
    });

    expect(readFileSync(join(root, "go.mod"), "utf8")).toContain("github.com/google/uuid v1.6.0");
  });

  test("allows a dependency-free Go module without go.sum", async () => {
    const root = createWorkspace("go.mod", "module example.com/tools\n\ngo 1.26.1\n");

    await expect(
      checkFiles({
        files: ["go.mod"],
        language: "go",
        lockfile: true,
        mode: "precise",
        rootDir: root,
        silent: true,
      }),
    ).resolves.toEqual([]);
  });
});
