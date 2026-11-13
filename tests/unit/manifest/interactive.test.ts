import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { checkFiles, versionCache, requestDeduplicator } from "../../../src/manifest";
import { NodeJSProvider, DockerProvider, RustProvider } from "../../../src/providers";
import { Prompt } from "../../../src/dx";
import { logger } from "../../../src/observability";
import { updateDockerFromLine } from "../../../src/providers/docker";
import type { CodeDependencies, Mode } from "../../../src/types";

const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

afterEach(() => {
  mock.restoreAll();
  versionCache.clear();
  requestDeduplicator.clear();
  if (stdinTTY) Object.defineProperty(process.stdin, "isTTY", stdinTTY);
  else delete (process.stdin as { isTTY?: boolean }).isTTY;
  if (stdoutTTY) Object.defineProperty(process.stdout, "isTTY", stdoutTTY);
  else delete (process.stdout as { isTTY?: boolean }).isTTY;
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
    mock.method(NodeJSProvider.prototype, "getLatestVersion", () => Promise.resolve("2.0.0"));
    const write = mock.method(NodeJSProvider.prototype, "writeManifest", () => {});
    mock.method(Prompt.prototype, "select", () => Promise.resolve(["alpha"]));

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
  mock.method(DockerProvider.prototype, "getLatestVersion", (_, tag: string) =>
    Promise.resolve(`24-${tag.split("-")[1]}`),
  );
  const write = mock.method(DockerProvider.prototype, "writeManifest", () => {});
  mock.method(Prompt.prototype, "select", () => Promise.resolve(["node"]));

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

const mockUpdateTerminal = (accepted = false) => {
  const env = { ...process.env, CI: "", GITHUB_ACTIONS: "" };
  mock.property(process, "env", env);
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
  mock.method(logger, "print", () => {});
  mock.method(logger, "info", () => {});
  return mock.method(Prompt.prototype, "confirm", () => Promise.resolve(accepted));
};

[false, true].forEach((accepted) => {
  test(`major confirmation checks every dependency section when accepted=${accepted}`, async () => {
    const confirm = mockUpdateTerminal(accepted);
    mock.method(NodeJSProvider.prototype, "readManifest", () => ({
      filePath: "package.json",
      dependencies: { alpha: "2.1.0", beta: "1.0.0" },
      devDependencies: { alpha: "1.0.0" },
    }));
    mock.method(NodeJSProvider.prototype, "getLatestVersion", (name: string) => {
      const version = name === "alpha" ? "2.2.0" : "1.1.0";
      return Promise.resolve(version);
    });
    const write = mock.method(NodeJSProvider.prototype, "writeManifest", () => {});

    await checkFiles({ files: ["package.json"], update: true, isCLI: true, lockfile: false });

    assert.strictEqual(confirm.mock.callCount(), 1);
    assert.strictEqual(confirm.mock.calls[0].arguments[1], false);
    assert.strictEqual(write.mock.callCount(), 1);
    const updated = write.mock.calls[0].arguments[1];
    const expectedDependency = accepted ? "2.2.0" : "2.1.0";
    const expectedDevDependency = accepted ? "2.2.0" : "1.0.0";
    assert.deepStrictEqual(updated.dependencies, { alpha: expectedDependency, beta: "1.1.0" });
    assert.deepStrictEqual(updated.devDependencies, { alpha: expectedDevDependency });
  });
});

test("major confirmation checks every workspace manifest before deduplication", async () => {
  const confirm = mockUpdateTerminal();
  mock.method(NodeJSProvider.prototype, "readManifest", (filePath: string) => {
    const alpha = filePath.includes("page/app") ? "1.0.0" : "2.1.0";
    return { filePath, dependencies: { alpha, beta: "1.0.0" } };
  });
  mock.method(NodeJSProvider.prototype, "getLatestVersion", (name: string) => {
    const version = name === "alpha" ? "2.2.0" : "1.1.0";
    return Promise.resolve(version);
  });
  const write = mock.method(NodeJSProvider.prototype, "writeManifest", () => {});

  await checkFiles({
    files: ["package.json", "page/app/package.json"],
    update: true,
    isCLI: true,
    lockfile: false,
  });

  assert.strictEqual(confirm.mock.callCount(), 1);
  assert.strictEqual(write.mock.callCount(), 2);
  write.mock.calls.forEach(({ arguments: [filePath, updated] }) => {
    const alpha = filePath.includes("page/app") ? "1.0.0" : "2.1.0";
    assert.deepStrictEqual(updated.dependencies, { alpha, beta: "1.1.0" });
  });
});

test("declining a Rust major update removes every normalized package alias", async () => {
  const confirm = mockUpdateTerminal();
  mock.method(RustProvider.prototype, "readManifest", () => ({
    filePath: "Cargo.toml",
    dependencies: { my_crate: "1.0.0", beta: "1.0.0" },
  }));
  const write = mock.method(RustProvider.prototype, "writeManifest", () => {});

  await checkFiles({
    files: ["package.json"],
    language: "rust",
    mode: "verbose",
    codependencies: [{ "my-crate": "2.0.0" }, { beta: "1.1.0" }],
    update: true,
    isCLI: true,
    lockfile: false,
  });

  assert.strictEqual(confirm.mock.callCount(), 1);
  assert.strictEqual(write.mock.callCount(), 1);
  assert.deepStrictEqual(write.mock.calls[0].arguments[1].dependencies, {
    my_crate: "1.0.0",
    beta: "1.1.0",
  });
});
