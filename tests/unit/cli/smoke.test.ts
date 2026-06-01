import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const cliArgs = [join(process.cwd(), "src/cli.ts")];

const makeProject = (): string => {
  const workDir = mkdtempSync(join("/tmp", "codependence-cli-smoke-"));
  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify(
      {
        name: "cli-smoke",
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
      ...cliArgs,
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

describe("CLI smoke", () => {
  test("formatted JSON checks exit non-zero when dependencies are outdated", () => {
    const workDir = makeProject();

    try {
      const result = runCli(workDir, ["--format", "json"]);
      const output = JSON.parse(result.stdout.trim());

      expect(result.status).toBe(1);
      expect(output.status).toBe("outdated");
      expect(output.summary.outdated).toBe(1);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("formatted JSON updates write requested changes and exit zero", () => {
    const workDir = makeProject();

    try {
      const result = runCli(workDir, ["--update", "--format", "json"]);
      const output = JSON.parse(result.stdout.trim());
      const packageJson = JSON.parse(
        readFileSync(join(workDir, "package.json"), "utf8"),
      );

      expect(result.status).toBe(0);
      expect(output.status).toBe("outdated");
      expect(packageJson.dependencies.lodash).toBe("4.18.0");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
