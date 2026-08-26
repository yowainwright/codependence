import { after, afterEach, beforeEach, describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith } from "../../../helpers/assertions";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { configureBinaryHost } from "../../../../src/cli/utils";
import { RustProvider } from "../../../../src/providers/rust";
import { exec } from "../../../../src/utils/process";

const execMock = mock.fn<typeof exec>();
const runExecMock = async (command: string, args: string[]): Promise<string> =>
  JSON.stringify(await execMock(command, args));
const restoreBinaryHost = configureBinaryHost(
  runExecMock,
  () => "{}",
  async () => "",
);

after(restoreBinaryHost);

describe("RustProvider", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-rust-test");
  const cargoPath = join(tmpDir, "Cargo.toml");

  afterEach(() => {
    execMock.mock.restore();
    execMock.mock.resetCalls();
  });

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new RustProvider({ isTesting: true });

    assert.strictEqual(provider.language, "rust");
    assert.deepStrictEqual(provider.capabilities, {
      supportsLatestResolution: true,
      supportsPreciseMode: true,
      versionStrategy: "semver",
    });
    assert.deepStrictEqual(await provider.getAllVersions("serde"), []);
    assert.strictEqual(provider.validatePackageName("serde_json"), true);
    assert.strictEqual(provider.validatePackageName("serde json"), false);
  });

  test("should read latest version from cargo search output", async () => {
    execMock.mock.mockImplementation(() => ({
      stdout: 'other = "2.0.0"\nserde = "1.0.210"',
      stderr: "",
    }));

    const provider = new RustProvider({ isTesting: true });

    const version = await provider.getLatestVersion("serde");

    assert.strictEqual(version, "1.0.210");
    assertCalledWith(execMock, "cargo", ["search", "serde", "--limit", "1"]);
  });

  test("should read latest version for normalized cargo package names", async () => {
    execMock.mock.mockImplementation(() => ({
      stdout: 'serde_json = "1.0.145"',
      stderr: "",
    }));

    const provider = new RustProvider({ isTesting: true });

    const version = await provider.getLatestVersion("serde-json");

    assert.strictEqual(version, "1.0.145");
  });

  test("should return empty latest version for unmatched cargo output", async () => {
    execMock.mock.mockImplementation(() => ({
      stdout: 'not a result\nother = "2.0.0"',
      stderr: "",
    }));

    const provider = new RustProvider({ isTesting: true });

    const version = await provider.getLatestVersion("serde");

    assert.strictEqual(version, "");
  });

  test("should read Cargo.toml dependency sections", () => {
    const content = `[package]
name = "demo"

[dependencies]
serde = "1.0.190"
tokio = { version = "1.32.0", features = ["full"] }
serde_json_renamed = { package = "serde_json", version = "1.0.100" }
broken = { version = "1.0.0, features = ["full"] }
local = { path = "../local" }

[dev-dependencies]
pretty_assertions = "1.4.0"

[target.'cfg(unix)'.dependencies]
nix = "0.27.1"
`;
    writeFileSync(cargoPath, content);

    const provider = new RustProvider();
    const manifest = provider.readManifest(cargoPath);

    assert.deepStrictEqual(manifest.dependencies, {
      serde: "1.0.190",
      tokio: "1.32.0",
      serde_json: "1.0.100",
      nix: "0.27.1",
    });
    assert.deepStrictEqual(manifest.devDependencies, {
      pretty_assertions: "1.4.0",
    });
  });

  test("should update Cargo.toml dependency versions in place", () => {
    const content = `[dependencies]
serde = "1.0.190"
tokio = { version = "1.32.0", features = ["full"] }
serde_json_renamed = { package = "serde_json", version = "1.0.100" }
local = { path = "../local" }

[dev-dependencies]
pretty_assertions = "1.4.0"
`;
    writeFileSync(cargoPath, content);

    const provider = new RustProvider();
    provider.writeManifest(cargoPath, {
      filePath: cargoPath,
      dependencies: {
        serde: "1.0.200",
        tokio: "1.35.0",
        serde_json: "1.0.145",
        local: "9.9.9",
      },
      devDependencies: {
        pretty_assertions: "1.4.1",
      },
    });

    const updated = readFileSync(cargoPath, "utf8");

    assert.ok(updated.includes('serde = "1.0.200"'));
    assert.ok(updated.includes('version = "1.35.0"'));
    assert.ok(
      updated.includes('serde_json_renamed = { package = "serde_json", version = "1.0.145" }'),
    );
    assert.ok(updated.includes('local = { path = "../local" }'));
    assert.ok(updated.includes('pretty_assertions = "1.4.1"'));
  });
});
