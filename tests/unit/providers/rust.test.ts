import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { RustProvider } from "../../../src/providers/rust";

describe("RustProvider", () => {
  const tmpDir = join(__dirname, ".tmp-rust-test");
  const cargoPath = join(tmpDir, "Cargo.toml");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
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
