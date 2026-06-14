import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const cliPath = join(process.cwd(), "src/cli.ts");

const createOutdatedProject = (): string => {
  const workDir = mkdtempSync(join(tmpdir(), "codependence-cli-json-"));

  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify(
      {
        name: "cli-json-contract",
        version: "1.0.0",
        dependencies: {
          lodash: "4.17.21",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(workDir, ".codependencerc"),
    JSON.stringify(
      {
        codependencies: [{ lodash: "4.18.0" }],
        files: ["package.json"],
      },
      null,
      2,
    ),
  );

  return workDir;
};

const runCli = (workDir: string, args: string[]) =>
  spawnSync(
    process.execPath,
    [
      cliPath,
      "--rootDir",
      workDir,
      "--searchPath",
      workDir,
      ...args,
    ],
    {
      encoding: "utf8",
    },
  );

const readPackageJson = (workDir: string) =>
  JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));

describe("CLI JSON output contract", () => {
  test("reports outdated dependencies as JSON and exits 1 without writing files", () => {
    const workDir = createOutdatedProject();

    try {
      const result = runCli(workDir, ["--format", "json"]);
      const output = JSON.parse(result.stdout.trim());
      const packageJson = readPackageJson(workDir);

      expect(result.status).toBe(1);
      expect(output.status).toBe("outdated");
      expect(output.summary.outdated).toBe(1);
      expect(output.dependencies).toEqual([
        {
          package: "lodash",
          current: "4.17.21",
          latest: "4.18.0",
          isPinned: true,
          severity: "minor",
          canAutoUpdate: true,
        },
      ]);
      expect(packageJson.dependencies.lodash).toBe("4.17.21");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("updates requested dependencies, prints JSON, and exits 0 with --update", () => {
    const workDir = createOutdatedProject();

    try {
      const result = runCli(workDir, ["--update", "--format", "json"]);
      const output = JSON.parse(result.stdout.trim());
      const packageJson = readPackageJson(workDir);

      expect(result.status).toBe(0);
      expect(output.status).toBe("outdated");
      expect(output.summary.outdated).toBe(1);
      expect(packageJson.dependencies.lodash).toBe("4.18.0");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("missing explicit config exits 2 instead of falling back to discovered config", () => {
    const workDir = createOutdatedProject();

    try {
      const result = runCli(workDir, [
        "--config",
        join(workDir, "missing-codependence.json"),
        "--format",
        "json",
      ]);
      const packageJson = readPackageJson(workDir);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Config file not found");
      expect(packageJson.dependencies.lodash).toBe("4.17.21");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("built CLI prints help when dist is present", () => {
    const distCliPath = join(process.cwd(), "dist/cli.js");
    if (!existsSync(distCliPath)) return;

    const result = spawnSync("node", [distCliPath, "--help"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage");
  });
});
