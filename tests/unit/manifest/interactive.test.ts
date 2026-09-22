import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { checkFiles, versionCache, requestDeduplicator } from "../../../src/manifest";
import { NodeJSProvider, DockerProvider } from "../../../src/providers";
import { Prompt } from "../../../src/dx";
import { updateDockerFromLine } from "../../../src/providers/docker";
import type { CodeDependencies, Mode } from "../../../src/types";

afterEach(() => {
  mock.restoreAll();
  versionCache.clear();
  requestDeduplicator.clear();
});

const cases: { mode: Mode; codependencies: CodeDependencies }[] = [
  { mode: "precise", codependencies: [] },
  { mode: "precise", codependencies: [{ beta: "1.0.0" }] },
  { mode: "verbose", codependencies: [{ alpha: "2.0.0" }, { beta: "2.0.0" }] },
];

cases.forEach(({ mode, codependencies }) => {
  test(`interactive ${mode} updates only the selection with ${codependencies.length} pins`, async () => {
    mock.method(NodeJSProvider.prototype, "readManifest", () => ({
      filePath: "package.json",
      dependencies: { alpha: "1.0.0", beta: "1.0.0", gamma: "1.0.0" },
    }));
    mock.method(NodeJSProvider.prototype, "getLatestVersion", async () => "2.0.0");
    const write = mock.method(NodeJSProvider.prototype, "writeManifest", () => {});
    mock.method(Prompt.prototype, "select", async () => ["alpha"]);

    await checkFiles({
      files: ["package.json"],
      mode,
      codependencies,
      update: true,
      interactive: true,
      silent: true,
      lockfile: false,
    });

    assert.strictEqual(write.mock.callCount(), 1);
    assert.deepStrictEqual(write.mock.calls[0].arguments[1].dependencies, {
      alpha: "2.0.0",
      beta: "1.0.0",
      gamma: "1.0.0",
    });
  });
});

test("interactive Docker updates exclude unselected per-tag resolutions", async () => {
  mock.method(DockerProvider.prototype, "readManifest", () => ({
    filePath: "Dockerfile",
    dependencies: { node: "20-alpine", redis: "7-alpine" },
    dependencyVersions: { node: ["20-slim", "20-alpine"], redis: ["7-slim", "7-alpine"] },
  }));
  mock.method(
    DockerProvider.prototype,
    "getLatestVersion",
    async (_, tag: string) => `24-${tag.split("-")[1]}`,
  );
  const write = mock.method(DockerProvider.prototype, "writeManifest", () => {});
  mock.method(Prompt.prototype, "select", async () => ["node"]);

  await checkFiles({
    files: ["package.json"],
    language: "docker",
    mode: "precise",
    update: true,
    interactive: true,
    silent: true,
  });

  assert.strictEqual(write.mock.callCount(), 1);
  const updated = write.mock.calls[0].arguments[1];
  assert.strictEqual(updated.dependencies.redis, "7-alpine");
  assert.deepStrictEqual(updated.resolvedDependencyVersions, {
    node: { "20-slim": "24-slim", "20-alpine": "24-alpine" },
    redis: { "7-slim": "7-slim", "7-alpine": "7-alpine" },
  });
  const lines = ["FROM redis:7-slim", "FROM redis:7-alpine"].map((line) =>
    updateDockerFromLine(line, updated.dependencies, updated.resolvedDependencyVersions),
  );
  assert.deepStrictEqual(lines, ["FROM redis:7-slim", "FROM redis:7-alpine"]);
});
