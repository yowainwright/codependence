import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { RustProvider } from "../../../src/providers/rust";

describe("RustProvider", () => {
  const tmpDir = join(__dirname, ".tmp-rust-test");
  const cargoPath = join(tmpDir, "Cargo.toml");

  afterEach(() => {
    mock.restore();
  });

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new RustProvider({ isTesting: true });

    expect(provider.language).toBe("rust");
    expect(await provider.getAllVersions("serde")).toEqual([]);
    expect(provider.validatePackageName("serde_json")).toBe(true);
    expect(provider.validatePackageName("serde json")).toBe(false);
  });

  test("should read latest version from cargo search output", async () => {
    const execMock = jest.fn(() => ({
      stdout: 'other = "2.0.0"\nserde = "1.0.210"',
      stderr: "",
    })) as any;

    const provider = new RustProvider({ isTesting: true });
    mock.module("../../../src/utils/exec", () => ({
      exec: execMock,
    }));

    const version = await provider.getLatestVersion("serde");

    expect(version).toBe("1.0.210");
    expect(execMock).toHaveBeenCalledWith("cargo", [
      "search",
      "serde",
      "--limit",
      "1",
    ]);
  });

  test("should read latest version for normalized cargo package names", async () => {
    const execMock = jest.fn(() => ({
      stdout: 'serde_json = "1.0.145"',
      stderr: "",
    })) as any;

    const provider = new RustProvider({ isTesting: true });
    mock.module("../../../src/utils/exec", () => ({
      exec: execMock,
    }));

    const version = await provider.getLatestVersion("serde-json");

    expect(version).toBe("1.0.145");
  });

  test("should return empty latest version for unmatched cargo output", async () => {
    const execMock = jest.fn(() => ({
      stdout: 'not a result\nother = "2.0.0"',
      stderr: "",
    })) as any;

    const provider = new RustProvider({ isTesting: true });
    mock.module("../../../src/utils/exec", () => ({
      exec: execMock,
    }));

    const version = await provider.getLatestVersion("serde");

    expect(version).toBe("");
  });

  test("should read Cargo.toml dependency sections", () => {
    const content = `[package]
name = "demo"

[dependencies]
serde = "1.0.190"
tokio = { version = "1.32.0", features = ["full"] }
local = { path = "../local" }

[dev-dependencies]
pretty_assertions = "1.4.0"

[target.'cfg(unix)'.dependencies]
nix = "0.27.1"
`;
    writeFileSync(cargoPath, content);

    const provider = new RustProvider();
    const manifest = provider.readManifest(cargoPath);

    expect(manifest.dependencies).toEqual({
      serde: "1.0.190",
      tokio: "1.32.0",
      nix: "0.27.1",
    });
    expect(manifest.devDependencies).toEqual({
      pretty_assertions: "1.4.0",
    });
  });

  test("should update Cargo.toml dependency versions in place", () => {
    const content = `[dependencies]
serde = "1.0.190"
tokio = { version = "1.32.0", features = ["full"] }
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
        local: "9.9.9",
      },
      devDependencies: {
        pretty_assertions: "1.4.1",
      },
    });

    const updated = readFileSync(cargoPath, "utf8");

    expect(updated).toContain('serde = "1.0.200"');
    expect(updated).toContain('version = "1.35.0"');
    expect(updated).toContain('local = { path = "../local" }');
    expect(updated).toContain('pretty_assertions = "1.4.1"');
  });
});
