import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { checkFiles, versionCache, requestDeduplicator } from "../../../src/manifest";
import { DockerProvider, updateDockerFromLine } from "../../../src/providers/docker";
import type { CheckFiles } from "../../../src/types";

afterEach(() => {
  mock.restoreAll();
  versionCache.clear();
  requestDeduplicator.clear();
});

const options: CheckFiles = {
  files: ["package.json"],
  language: "docker",
  mode: "precise",
  silent: true,
  format: "json",
};

const mockDocker = () => {
  mock.method(DockerProvider.prototype, "readManifest", () => ({
    filePath: "Dockerfile",
    dependencies: { node: "20-alpine" },
    dependencyVersions: { node: ["20-slim", "20-alpine"] },
  }));
  return mock.method(DockerProvider.prototype, "getLatestVersion", (_, tag: string) => {
    if (tag === "20-slim") return Promise.resolve("24-slim");
    return Promise.resolve("24-alpine");
  });
};

test("cached Docker resolutions preserve every tag from preview through update", async () => {
  const lookup = mockDocker();
  const write = mock.method(DockerProvider.prototype, "writeManifest", () => {});
  const preview = await checkFiles({ ...options, dryRun: true });
  const result = await checkFiles({ ...options, update: true });

  assert.deepStrictEqual(result, preview);
  assert.strictEqual(lookup.mock.callCount(), 2);
  assert.strictEqual(write.mock.callCount(), 1);
  const updated = write.mock.calls[0].arguments[1];
  const lines = ["FROM node:20-slim", "FROM node:20-alpine"].map((line) =>
    updateDockerFromLine(line, updated.dependencies, updated.resolvedDependencyVersions),
  );
  assert.deepStrictEqual(lines, ["FROM node:24-slim", "FROM node:24-alpine"]);
});

test("concurrent Docker checks each receive all deduplicated tag resolutions", async () => {
  const lookup = mockDocker();
  const results = await Promise.all([checkFiles(options), checkFiles(options)]);

  assert.deepStrictEqual(results[0], results[1]);
  assert.strictEqual(results[0]?.length, 2);
  assert.strictEqual(lookup.mock.callCount(), 2);
});

test("noCache refreshes all Docker tag resolutions", async () => {
  const lookup = mockDocker();
  const first = await checkFiles(options);
  const second = await checkFiles({ ...options, noCache: true });

  assert.deepStrictEqual(first, second);
  assert.strictEqual(lookup.mock.callCount(), 4);
});
