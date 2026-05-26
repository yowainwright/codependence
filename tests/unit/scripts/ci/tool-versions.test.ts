import { describe, expect, test } from "bun:test";
import {
  formatGitHubOutput,
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

describe("scripts/ci/tool-versions", () => {
  test("parseMiseTool reads quoted tool versions", () => {
    expect(parseMiseTool(miseToml, "bun")).toBe("1.3.14");
    expect(parseMiseTool(miseToml, "node")).toBe("24");
  });

  test("parsePackageManagerBunVersion reads packageManager", () => {
    expect(parsePackageManagerBunVersion({ packageManager: "bun@1.3.14" })).toBe("1.3.14");
    expect(parsePackageManagerBunVersion({ packageManager: "npm@11.0.0" })).toBe("");
  });

  test("resolveToolVersions prefers explicit env overrides", () => {
    expect(
      resolveToolVersions({
        env: {
          INPUT_BUN_VERSION: "1.2.3",
          INPUT_NODE_VERSION: "22",
          NODE_ALPINE_IMAGE: "node:22-alpine@sha256:test",
          NODE_SLIM_IMAGE: "node:22-slim@sha256:test",
        },
        miseToml,
        packageJson: { packageManager: "bun@1.3.14" },
      }),
    ).toEqual({
      bunVersion: "1.2.3",
      nodeAlpineImage: "node:22-alpine@sha256:test",
      nodeSlimImage: "node:22-slim@sha256:test",
      nodeVersion: "22",
    });
  });

  test("formatGitHubOutput emits stable output names", () => {
    expect(
      formatGitHubOutput({
        bunVersion: "1.3.14",
        nodeAlpineImage: "node:24-alpine",
        nodeSlimImage: "node:24-slim",
        nodeVersion: "24",
      }),
    ).toBe(
      [
        "bun_version=1.3.14",
        "node_alpine_image=node:24-alpine",
        "node_slim_image=node:24-slim",
        "node_version=24",
      ].join("\n"),
    );
  });

  test("resolveToolVersionValue rejects unknown keys", () => {
    expect(() =>
      resolveToolVersionValue("missing", {
        bunVersion: "1.3.14",
        nodeAlpineImage: "node:24-alpine",
        nodeSlimImage: "node:24-slim",
        nodeVersion: "24",
      }),
    ).toThrow("Unknown tool version key");
  });
});
