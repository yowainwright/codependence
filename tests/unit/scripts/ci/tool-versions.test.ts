import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import {
  formatGitHubOutput,
  parseDockerfileArg,
  parseMiseTool,
  parsePackageManagerBunVersion,
  resolveToolVersionValue,
  resolveToolVersions,
} from "../../../../scripts/ci/tool-versions.js";
import {
  BUN_LINUX_AARCH64_SHA256 as bunLinuxAarch64Sha256,
  BUN_LINUX_X64_SHA256 as bunLinuxX64Sha256,
  DOCKER_PINS as dockerPins,
  MISE_TOML as miseToml,
  NODE_ALPINE_IMAGE as nodeAlpineImage,
  NODE_SLIM_IMAGE as nodeSlimImage,
} from "./constants";

type E2eRunner = {
  cleanupCommand: string;
  command: string;
  name: string;
  scriptPath: string;
};

type E2eRunResult = {
  commands: string[];
  status: number | null;
};

type DockerFixture = {
  fixturePath: string;
  logPath: string;
};

const DOCKER_CLEANUP_COMMAND =
  "image rm --force codependence-test:latest codependence-builder:latest codependence-level-mode-test:latest";
const MULTILANG_CLEANUP_COMMAND =
  "image rm --force codependence-test:latest codependence-multilang-test:latest";
const DOCKER_RUN_FAILURE = { DOCKER_RUN_EXIT: "7" };
const DOCKER_RUN_INTERRUPTION = { DOCKER_RUN_SIGNAL: "TERM" };
const REMOVE_FIXTURE_OPTIONS = { force: true, recursive: true };
const E2E_RUNNERS: E2eRunner[] = [
  {
    cleanupCommand: DOCKER_CLEANUP_COMMAND,
    command: "test",
    name: "Docker",
    scriptPath: "tests/e2e/test.sh",
  },
  {
    cleanupCommand: MULTILANG_CLEANUP_COMMAND,
    command: "init",
    name: "multi-language",
    scriptPath: "tests/e2e/test-multilang.sh",
  },
];
const FAKE_DOCKER = `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then exit 0; fi
if [ "$1" = "build" ]; then exit "\${DOCKER_BUILD_EXIT:-0}"; fi
if [ "$1" = "run" ] && [ -n "\${DOCKER_RUN_SIGNAL:-}" ]; then
  kill "-$DOCKER_RUN_SIGNAL" "$PPID"
fi
if [ "$1" = "run" ]; then exit "\${DOCKER_RUN_EXIT:-0}"; fi
exit 0
`;
const REPOSITORY_ROOT_URL = new URL("../../../../", import.meta.url);
const REPOSITORY_ROOT = fileURLToPath(REPOSITORY_ROOT_URL);

function createDockerFixture(): DockerFixture {
  const fixturePrefix = join(tmpdir(), "codependence-docker-cleanup-");
  const fixturePath = mkdtempSync(fixturePrefix);
  const dockerPath = join(fixturePath, "docker");
  const logPath = join(fixturePath, "docker.log");
  writeFileSync(dockerPath, FAKE_DOCKER);
  chmodSync(dockerPath, 0o755);
  return { fixturePath, logPath };
}

function runE2eWithFakeDocker(
  runner: E2eRunner,
  overrides: NodeJS.ProcessEnv = {},
): E2eRunResult {
  const { fixturePath, logPath } = createDockerFixture();
  const path = `${fixturePath}:${process.env.PATH ?? ""}`;
  const env = { ...process.env, ...overrides, DOCKER_LOG: logPath, PATH: path };
  const spawnOptions = { cwd: REPOSITORY_ROOT, encoding: "utf8" as const, env };
  const args = [runner.scriptPath, runner.command];
  try {
    const result = spawnSync("bash", args, spawnOptions);
    const log = readFileSync(logPath, "utf8").trim();
    const commands = log.split("\n");
    const status = result.status;
    return { commands, status };
  } finally {
    rmSync(fixturePath, REMOVE_FIXTURE_OPTIONS);
  }
}

function expectScopedCleanup(result: E2eRunResult, runner: E2eRunner): void {
  const cleanupCommand = result.commands.at(-1);
  const systemPrune = result.commands.find((command) => command.startsWith("system prune"));
  expect(cleanupCommand).toBe(runner.cleanupCommand);
  expect(systemPrune).toBeUndefined();
}

function resolveVersions(overrides = {}) {
  return resolveToolVersions({
    dockerPins,
    miseToml,
    nodeAlpineImage,
    nodeSlimImage,
    packageJson: { packageManager: "bun@1.3.14" },
    ...overrides,
  });
}

describe("scripts/ci/tool-versions", () => {
  test("parseMiseTool reads quoted tool versions", () => {
    expect(parseMiseTool(miseToml, "bun")).toBe("1.3.14");
    expect(parseMiseTool(miseToml, "node")).toBe("26.7.0");
    expect(parseMiseTool(miseToml, "nub")).toBe("0.7.5");
  });

  test("parsePackageManagerBunVersion reads packageManager", () => {
    expect(parsePackageManagerBunVersion({ packageManager: "bun@1.3.14" })).toBe("1.3.14");
    expect(parsePackageManagerBunVersion({ packageManager: "npm@11.0.0" })).toBe("");
  });

  test("parseDockerfileArg reads pinned ARG defaults", () => {
    expect(
      parseDockerfileArg(
        `ARG NODE_SLIM_IMAGE=${nodeSlimImage}\nFROM \${NODE_SLIM_IMAGE}`,
        "NODE_SLIM_IMAGE",
      ),
    ).toBe(nodeSlimImage);
  });

  test("e2e Dockerfiles share the same pinned Node slim image", () => {
    const dockerfiles = [
      "tests/e2e/Dockerfile",
      "tests/e2e/Dockerfile.level-mode",
      "tests/e2e/Dockerfile.multilang",
    ];

    expect(
      dockerfiles.map((dockerfile) =>
        parseDockerfileArg(
          readFileSync(new URL(`../../../../${dockerfile}`, import.meta.url), "utf8"),
          "NODE_SLIM_IMAGE",
        ),
      ),
    ).toEqual([nodeSlimImage, nodeSlimImage, nodeSlimImage]);
  });

  E2E_RUNNERS.forEach((runner) => {
    test(`${runner.name} e2e cleans Docker images after success`, () => {
      const result = runE2eWithFakeDocker(runner);
      expect(result.status).toBe(0);
      expectScopedCleanup(result, runner);
    });

    test(`${runner.name} e2e cleans Docker images after failure`, () => {
      const result = runE2eWithFakeDocker(runner, DOCKER_RUN_FAILURE);
      expect(result.status).not.toBe(0);
      expectScopedCleanup(result, runner);
    });

    test(`${runner.name} e2e cleans Docker images after interruption`, () => {
      const result = runE2eWithFakeDocker(runner, DOCKER_RUN_INTERRUPTION);
      expect(result.status).toBe(143);
      expectScopedCleanup(result, runner);
    });
  });

  test("release Dockerfiles share the same pinned Node alpine image", () => {
    const dockerfiles = [
      "tests/release/Dockerfile.npm-smoke",
      "tests/release/Dockerfile.published",
    ];

    expect(
      dockerfiles.map((dockerfile) =>
        parseDockerfileArg(
          readFileSync(new URL(`../../../../${dockerfile}`, import.meta.url), "utf8"),
          "NODE_ALPINE_IMAGE",
        ),
      ),
    ).toEqual([nodeAlpineImage, nodeAlpineImage]);
  });

  test("resolveToolVersions prefers explicit env overrides", () => {
    expect(
      resolveVersions({
        env: {
          BUN_LINUX_AARCH64_SHA256: "aarch64-test",
          BUN_LINUX_X64_SHA256: "x64-test",
          INPUT_BUN_VERSION: "1.2.3",
          INPUT_NODE_VERSION: "22",
          NODE_ALPINE_IMAGE: "node:22-alpine@sha256:test",
          NODE_SLIM_IMAGE: "node:22-slim@sha256:test",
        },
      }),
    ).toEqual({
      bunLinuxAarch64Sha256: "aarch64-test",
      bunLinuxX64Sha256: "x64-test",
      bunVersion: "1.2.3",
      nodeAlpineImage: "node:22-alpine@sha256:test",
      nodeSlimImage: "node:22-slim@sha256:test",
      nodeVersion: "22",
      nubVersion: "0.7.5",
    });
  });

  test("resolveToolVersions keeps digest pins for patch-level Node versions", () => {
    expect(
      resolveVersions({
        miseToml: `
[tools]
bun = "1.3.14"
node = "26.3.0"
nub = "0.7.5"
`,
      }),
    ).toMatchObject({
      nodeAlpineImage,
      nodeSlimImage,
      nodeVersion: "26.3.0",
    });
  });

  test("resolveToolVersions keeps project Docker pins for runtime Node overrides", () => {
    expect(resolveVersions({ env: { INPUT_NODE_VERSION: "20" } })).toMatchObject({
      nodeAlpineImage,
      nodeSlimImage,
      nodeVersion: "20",
    });
  });

  test("resolveToolVersions rejects unpinned Docker image defaults", () => {
    expect(() => resolveVersions({ nodeSlimImage: "node:26-slim" })).toThrow("Expected slim image");
  });

  test("formatGitHubOutput emits stable output names", () => {
    expect(
      formatGitHubOutput({
        bunLinuxAarch64Sha256,
        bunLinuxX64Sha256,
        bunVersion: "1.3.14",
        nodeAlpineImage,
        nodeSlimImage,
        nodeVersion: "24",
        nubVersion: "0.7.5",
      }),
    ).toBe(
      [
        `bun_linux_aarch64_sha256=${bunLinuxAarch64Sha256}`,
        `bun_linux_x64_sha256=${bunLinuxX64Sha256}`,
        "bun_version=1.3.14",
        `node_alpine_image=${nodeAlpineImage}`,
        `node_slim_image=${nodeSlimImage}`,
        "node_version=24",
        "nub_version=0.7.5",
      ].join("\n"),
    );
  });

  test("setup action passes the resolved Nub version to both branches", () => {
    const action = readFileSync(
      new URL("../../../../.github/actions/setup-toolchain/action.yml", import.meta.url),
      "utf8",
    );
    const nubPins = action.match(
      /nub-version: \$\{\{ steps\.tool-versions\.outputs\.nub_version \}\}/g,
    );

    expect(nubPins).toHaveLength(2);
  });

  test("contributor setup names the official scoped Nub package", () => {
    const contributing = readFileSync(
      new URL("../../../../.github/CONTRIBUTING.md", import.meta.url),
      "utf8",
    );

    expect(contributing).toContain("npm install --global @nubjs/nub@0.7.5");
    expect(contributing).toContain("https://nubjs.com/docs/install");
  });

  test("resolveToolVersionValue rejects unknown keys", () => {
    expect(() =>
      resolveToolVersionValue("missing", {
        bunLinuxAarch64Sha256,
        bunLinuxX64Sha256,
        bunVersion: "1.3.14",
        nodeAlpineImage,
        nodeSlimImage,
        nodeVersion: "24",
        nubVersion: "0.7.5",
      }),
    ).toThrow("Unknown tool version key");
  });

  test("direct Node CLI prints requested tool versions", () => {
    const result = spawnSync("node", ["scripts/ci/tool-versions.js", "node-slim-image"], {
      cwd: new URL("../../../../", import.meta.url),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe(nodeSlimImage);
  });

  test("direct Node CLI prints requested Bun archive hash", () => {
    const result = spawnSync("node", ["scripts/ci/tool-versions.js", "bun-linux-x64-sha256"], {
      cwd: new URL("../../../../", import.meta.url),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe(bunLinuxX64Sha256);
  });
});
