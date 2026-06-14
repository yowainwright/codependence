import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  formatGitHubOutput,
  parseDockerfileArg,
  parseMiseTool,
  parsePackageManagerBunVersion,
  resolveToolVersionValue,
  resolveToolVersions,
} from "../../../../scripts/ci/tool-versions.js";

const miseToml = `
[tools]
bun = "1.3.14"
node = "24"
`;

const nodeAlpineImage =
  "node:24-alpine@sha256:fb71d01345f11b708a3553c66e7c74074f2d506400ea81973343d915cb64eef0";
const nodeSlimImage =
  "node:24-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203";
const bunLinuxAarch64Sha256 = "a27ffb63a8310375836e0d6f668ae17fa8d8d18b88c37c821c65331973a19a3b";
const bunLinuxX64Sha256 = "951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f";
const dockerPins = {
  bunArchives: {
    "1.3.14": {
      "linux-aarch64": bunLinuxAarch64Sha256,
      "linux-x64": bunLinuxX64Sha256,
    },
  },
};

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
    expect(parseMiseTool(miseToml, "node")).toBe("24");
  });

  test("parsePackageManagerBunVersion reads packageManager", () => {
    expect(parsePackageManagerBunVersion({ packageManager: "bun@1.3.14" })).toBe("1.3.14");
    expect(parsePackageManagerBunVersion({ packageManager: "npm@11.0.0" })).toBe("");
  });

  test("parseDockerfileArg reads pinned ARG defaults", () => {
    expect(
      parseDockerfileArg(`ARG NODE_SLIM_IMAGE=${nodeSlimImage}\nFROM \${NODE_SLIM_IMAGE}`, "NODE_SLIM_IMAGE"),
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

  test("release Dockerfiles share the same pinned Node alpine image", () => {
    const dockerfiles = ["tests/release/Dockerfile.npm-smoke", "tests/release/Dockerfile.published"];

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
    });
  });

  test("resolveToolVersions keeps digest pins for patch-level Node versions", () => {
    expect(
      resolveVersions({
        miseToml: `
[tools]
bun = "1.3.14"
node = "24.3.0"
`,
      }),
    ).toMatchObject({
      nodeAlpineImage,
      nodeSlimImage,
      nodeVersion: "24.3.0",
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
    expect(() => resolveVersions({ nodeSlimImage: "node:24-slim" })).toThrow("Expected slim image");
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
      }),
    ).toBe(
      [
        `bun_linux_aarch64_sha256=${bunLinuxAarch64Sha256}`,
        `bun_linux_x64_sha256=${bunLinuxX64Sha256}`,
        "bun_version=1.3.14",
        `node_alpine_image=${nodeAlpineImage}`,
        `node_slim_image=${nodeSlimImage}`,
        "node_version=24",
      ].join("\n"),
    );
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
