import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const cliPath = join(process.cwd(), "src/cli/index.ts");
const runnerPath = join(process.cwd(), "scripts/run/index.ts");

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

const runCli = (workDir: string, args: string[]) => {
  const nodeArgs = [
    "--import",
    runnerPath,
    cliPath,
    "--rootDir",
    workDir,
    "--searchPath",
    workDir,
    ...args,
  ];
  return spawnSync(process.execPath, nodeArgs, { encoding: "utf8" });
};

const readPackageJson = (workDir: string) =>
  JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("CLI JSON output contract", () => {
  test("reports outdated dependencies as JSON and exits 1 without writing files", () => {
    const workDir = createOutdatedProject();

    try {
      const result = runCli(workDir, ["--format", "json"]);
      const output = JSON.parse(result.stdout.trim());
      const packageJson = readPackageJson(workDir);

      assert.strictEqual(result.status, 1);
      assert.strictEqual(output.status, "outdated");
      assert.strictEqual(output.summary.outdated, 1);
      assert.deepStrictEqual(output.dependencies, [
        {
          package: "lodash",
          current: "4.17.21",
          latest: "4.18.0",
          isPinned: true,
          severity: "minor",
          canAutoUpdate: true,
        },
      ]);
      assert.strictEqual(packageJson.dependencies.lodash, "4.17.21");
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

      assert.strictEqual(result.status, 0);
      assert.strictEqual(output.status, "outdated");
      assert.strictEqual(output.summary.outdated, 1);
      assert.strictEqual(packageJson.dependencies.lodash, "4.18.0");
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

      assert.strictEqual(result.status, 2);
      assert.ok(result.stderr.includes("Config file not found"));
      assert.strictEqual(packageJson.dependencies.lodash, "4.17.21");
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

    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes("Usage"));
  });
});

test("--security without --format behaves like a plain run", () => {
  const workDir = createOutdatedProject();

  try {
    const plain = runCli(workDir, []);
    const secured = runCli(workDir, ["--security"]);

    assert.strictEqual(secured.status, plain.status);
    assert.doesNotMatch(secured.stdout, /Security|vulnerab/i);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

type LegacyProject = { workDir: string; read: () => string | undefined };

const createLegacyProject = (files: Record<string, unknown>): LegacyProject => {
  const workDir = mkdtempSync(join(tmpdir(), "codependence-cli-legacy-"));
  Object.entries(files).forEach(([name, content]) => {
    writeFileSync(join(workDir, name), JSON.stringify(content, null, 2));
  });
  return { workDir, read: () => readPackageJson(workDir).dependencies["fs-extra"] };
};

const legacyManifest = {
  name: "legacy",
  version: "1.0.0",
  dependencies: { "fs-extra": "^8.0.0" },
};

test("0.3.x config => package.json codependence key reports a mismatched pin", () => {
  const manifest = {
    ...legacyManifest,
    codependence: { codependencies: [{ "fs-extra": "^9.0.0" }] },
  };
  const { workDir, read } = createLegacyProject({ "package.json": manifest });

  try {
    assert.strictEqual(runCli(workDir, []).status, 1);
    assert.strictEqual(read(), "^8.0.0");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("0.3.x config => package.json codependence key is rewritten by --update", () => {
  const manifest = {
    ...legacyManifest,
    codependence: { codependencies: [{ "fs-extra": "^9.0.0" }] },
  };
  const { workDir, read } = createLegacyProject({ "package.json": manifest });

  try {
    assert.strictEqual(runCli(workDir, ["--update"]).status, 0);
    assert.strictEqual(read(), "^9.0.0");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("0.3.x config => a matching pin in the package.json key exits 0", () => {
  const manifest = {
    ...legacyManifest,
    dependencies: { "fs-extra": "^9.0.0" },
    codependence: { codependencies: [{ "fs-extra": "^9.0.0" }] },
  };
  const { workDir } = createLegacyProject({ "package.json": manifest });

  try {
    assert.strictEqual(runCli(workDir, []).status, 0);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("0.3.x config => a flat .codependencerc with files is rewritten by --update", () => {
  const rc = { codependencies: [{ "fs-extra": "^9.0.0" }], files: ["package.json"] };
  const { workDir, read } = createLegacyProject({
    "package.json": legacyManifest,
    ".codependencerc": rc,
  });

  try {
    assert.strictEqual(runCli(workDir, ["--update"]).status, 0);
    assert.strictEqual(read(), "^9.0.0");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
