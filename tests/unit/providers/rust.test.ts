import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  RustProvider,
  parseCargoDependencyLine,
  updateCargoDependencyLine,
} from "../../../src/providers/rust";

describe("RustProvider", () => {
  const tmpDir = join(__dirname, ".tmp-rust-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("reads Cargo.toml registry dependencies", () => {
    const cargoPath = join(tmpDir, "Cargo.toml");
    writeFileSync(
      cargoPath,
      `[dependencies]
pyo3 = { version = "0.29", features = ["extension-module"] }
ruff_python_ast = { git = "https://github.com/astral-sh/ruff.git", rev = "07b4eded" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
insta = "1.40"

[target.'cfg(unix)'.dependencies]
nix = "0.29"
`,
    );

    const provider = new RustProvider({ isTesting: true });
    const manifest = provider.readManifest(cargoPath);

    expect(manifest.dependencies).toEqual({
      pyo3: "0.29",
      serde: "1",
      serde_json: "1",
      nix: "0.29",
    });
    expect(manifest.devDependencies).toEqual({ insta: "1.40" });
  });

  test("updates Cargo.toml versions without touching git dependencies", () => {
    const cargoPath = join(tmpDir, "Cargo.toml");
    writeFileSync(
      cargoPath,
      `[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
ruff_python_ast = { git = "https://github.com/astral-sh/ruff.git", rev = "07b4eded" }
`,
    );

    const provider = new RustProvider({ isTesting: true });
    provider.writeManifest(cargoPath, {
      filePath: cargoPath,
      dependencies: {
        serde: "1.2",
        serde_json: "1.1",
        ruff_python_ast: "0.1",
      },
    });

    const updated = readFileSync(cargoPath, "utf8");
    expect(updated).toContain('serde = { version = "1.2", features = ["derive"] }');
    expect(updated).toContain('serde_json = "1.1"');
    expect(updated).toContain('ruff_python_ast = { git = "https://github.com/astral-sh/ruff.git"');
  });

  test("parses and updates individual cargo dependency lines", () => {
    expect(parseCargoDependencyLine('serde_json = "1"')).toEqual({
      name: "serde_json",
      version: "1",
    });

    const updated = updateCargoDependencyLine('serde_json = "1"', {
      serde_json: "1.1",
    });
    expect(updated).toBe('serde_json = "1.1"');
  });
});
