import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertMatchObject, assertThrows } from "../../../helpers/assertions";
import {
  formatGitHubOutput,
  parseDockerfileArg,
  parseMiseTool,
  resolveToolVersionValue,
  resolveToolVersions,
} from "../../../../scripts/ci/tool-versions.js";
import {
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

function runE2eWithFakeDocker(runner: E2eRunner, overrides: NodeJS.ProcessEnv = {}): E2eRunResult {
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
  assert.strictEqual((cleanupCommand), runner.cleanupCommand);
  assert.strictEqual((systemPrune), undefined);
}

function resolveVersions(overrides = {}) {
  return resolveToolVersions({
    miseToml,
    nodeAlpineImage,
    nodeSlimImage,
    ...overrides,
  });
}

describe("scripts/ci/tool-versions", () => {
  test("parseMiseTool reads quoted tool versions", () => {
    assert.strictEqual((parseMiseTool(miseToml, "node")), "26.7.0");
    assert.strictEqual((parseMiseTool(miseToml, "nub")), "0.7.5");
  });

  test("parseDockerfileArg reads pinned ARG defaults", () => {
    assert.strictEqual(parseDockerfileArg(
        `ARG NODE_SLIM_IMAGE=${nodeSlimImage}\nFROM \${NODE_SLIM_IMAGE}`,
        "NODE_SLIM_IMAGE",
      ), nodeSlimImage);
  });

  test("e2e Dockerfiles share the same pinned Node slim image", () => {
    const dockerfiles = [
      "tests/e2e/Dockerfile",
      "tests/e2e/Dockerfile.level-mode",
      "tests/e2e/Dockerfile.multilang",
    ];

    assert.deepStrictEqual(dockerfiles.map((dockerfile) =>
        parseDockerfileArg(
          readFileSync(new URL(`../../../../${dockerfile}`, import.meta.url), "utf8"),
          "NODE_SLIM_IMAGE",
        ),
      ), [nodeSlimImage, nodeSlimImage, nodeSlimImage]);
  });

  E2E_RUNNERS.forEach((runner) => {
    test(`${runner.name} e2e cleans Docker images after success`, () => {
      const result = runE2eWithFakeDocker(runner);
      assert.strictEqual((result.status), 0);
      expectScopedCleanup(result, runner);
    });

    test(`${runner.name} e2e cleans Docker images after failure`, () => {
      const result = runE2eWithFakeDocker(runner, DOCKER_RUN_FAILURE);
      assert.notStrictEqual((result.status), 0);
      expectScopedCleanup(result, runner);
    });

    test(`${runner.name} e2e cleans Docker images after interruption`, () => {
      const result = runE2eWithFakeDocker(runner, DOCKER_RUN_INTERRUPTION);
      assert.strictEqual((result.status), 143);
      expectScopedCleanup(result, runner);
    });
  });

  test("release Dockerfiles share the same pinned Node alpine image", () => {
    const dockerfiles = [
      "tests/release/Dockerfile.npm-smoke",
      "tests/release/Dockerfile.published",
    ];

    assert.deepStrictEqual(dockerfiles.map((dockerfile) =>
        parseDockerfileArg(
          readFileSync(new URL(`../../../../${dockerfile}`, import.meta.url), "utf8"),
          "NODE_ALPINE_IMAGE",
        ),
      ), [nodeAlpineImage, nodeAlpineImage]);
  });

  test("resolveToolVersions prefers explicit env overrides", () => {
    assert.deepStrictEqual(resolveVersions({
        env: {
          INPUT_NODE_VERSION: "22",
          NODE_ALPINE_IMAGE: "node:22-alpine@sha256:test",
          NODE_SLIM_IMAGE: "node:22-slim@sha256:test",
        },
      }), {
      nodeAlpineImage: "node:22-alpine@sha256:test",
      nodeSlimImage: "node:22-slim@sha256:test",
      nodeVersion: "22",
      nubVersion: "0.7.5",
    });
  });

  test("resolveToolVersions keeps digest pins for patch-level Node versions", () => {
    assertMatchObject(resolveVersions({
        miseToml: `
[tools]
node = "26.3.0"
nub = "0.7.5"
`,
      }), {
      nodeAlpineImage,
      nodeSlimImage,
      nodeVersion: "26.3.0",
    });
  });

  test("resolveToolVersions keeps project Docker pins for runtime Node overrides", () => {
    assertMatchObject((resolveVersions({ env: { INPUT_NODE_VERSION: "20" } })), {
      nodeAlpineImage,
      nodeSlimImage,
      nodeVersion: "20",
    });
  });

  test("resolveToolVersions rejects unpinned Docker image defaults", () => {
    assertThrows((() => resolveVersions({ nodeSlimImage: "node:26-slim" })), "Expected slim image");
  });

  test("formatGitHubOutput emits stable output names", () => {
    assert.strictEqual(formatGitHubOutput({
        nodeAlpineImage,
        nodeSlimImage,
        nodeVersion: "24",
        nubVersion: "0.7.5",
      }), [
        `node_alpine_image=${nodeAlpineImage}`,
        `node_slim_image=${nodeSlimImage}`,
        "node_version=24",
        "nub_version=0.7.5",
      ].join("\n"));
  });

  test("setup action passes the resolved Nub version to both branches", () => {
    const action = readFileSync(
      new URL("../../../../.github/actions/setup-toolchain/action.yml", import.meta.url),
      "utf8",
    );
    const nubPins = action.match(
      /nub-version: \$\{\{ steps\.tool-versions\.outputs\.nub_version \}\}/g,
    );

    assert.strictEqual((nubPins).length, 2);
  });

  test("contributor setup names the official scoped Nub package", () => {
    const contributing = readFileSync(
      new URL("../../../../.github/CONTRIBUTING.md", import.meta.url),
      "utf8",
    );

    assert.ok((contributing).includes("npm install --global @nubjs/nub@0.7.5"));
    const installLink = /^\[nub-install\]: (.+)$/m.exec(contributing);
    assert.ok(installLink);
    assert.strictEqual(installLink[1], "https://nubjs.com/docs/install");
  });

  test("resolveToolVersionValue rejects unknown keys", () => {
    assertThrows(() =>
      resolveToolVersionValue("missing", {
        nodeAlpineImage,
        nodeSlimImage,
        nodeVersion: "24",
        nubVersion: "0.7.5",
      }), "Unknown tool version key");
  });

  test("direct Node CLI prints requested tool versions", () => {
    const result = spawnSync("node", ["scripts/ci/tool-versions.js", "node-slim-image"], {
      cwd: new URL("../../../../", import.meta.url),
      encoding: "utf8",
    });

    assert.strictEqual((result.status), 0);
    assert.strictEqual((result.stderr), "");
    assert.strictEqual((result.stdout.trim()), nodeSlimImage);
  });
});
