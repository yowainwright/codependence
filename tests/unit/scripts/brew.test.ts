import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLocalFormula,
  fetchPublishedTarball,
  npmTarballUrl,
  renderFormula,
  runBrewCli,
  sha256,
  validateStableVersion,
} from "../../../scripts/brew";

describe("scripts/brew", () => {
  test("builds the published npm tarball URL", () => {
    const url = "https://registry.npmjs.org/codependence/-/codependence-1.1.0.tgz";
    expect(npmTarballUrl("1.1.0")).toBe(url);
  });

  test("accepts only stable versions", () => {
    expect(() => validateStableVersion("1.1.0")).not.toThrow();
    expect(() => validateStableVersion("1.1.0-beta.1")).toThrow("Invalid stable version");
    expect(() => validateStableVersion("v1.1.0")).toThrow("Invalid stable version");
  });

  test("rejects prereleases before generating", async () => {
    const options = { argv: ["validate-version"], env: { VERSION: "1.1.0-rc.0" } };
    await expect(runBrewCli(options)).rejects.toThrow("Invalid stable version");
  });

  test("downloads published tarball bytes", async () => {
    const fetchImpl = async () => new Response("published tarball");
    const tarball = await fetchPublishedTarball(npmTarballUrl("1.1.0"), fetchImpl);
    expect(tarball).toEqual(Buffer.from("published tarball"));
  });

  test("rejects unavailable published tarballs", async () => {
    const fetchImpl = async () => new Response(null, { status: 404 });
    const download = fetchPublishedTarball(npmTarballUrl("1.1.0"), fetchImpl);
    await expect(download).rejects.toThrow("Unable to download published tarball: 404");
  });

  test("computes a hexadecimal SHA256", () => {
    const digest = sha256(Buffer.from("hello"));
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[a-f0-9]+$/);
  });

  test("renders a Node-backed formula", () => {
    const formula = renderFormula({ digest: "abc123", url: npmTarballUrl("1.1.0") });
    expect(formula).not.toMatch(/^\s+version\s/m);
    expect(formula).toContain('depends_on "node"');
    expect(formula).toContain('system bin/"codependence", "--help"');
    expect(formula).toContain('system bin/"cdp", "--help"');
  });

  test("generates a formula from a local tarball", () => {
    const directory = mkdtempSync(join(tmpdir(), "codependence-brew-"));
    const outputPath = join(directory, "codependence.rb");
    const tarballPath = join(directory, "codependence.tgz");
    try {
      writeFileSync(tarballPath, "local tarball");
      const formula = createLocalFormula({ outputPath, tarballPath, version: "1.1.0" });
      expect(formula.digest).toBe(sha256(Buffer.from("local tarball")));
      expect(readFileSync(outputPath, "utf8")).not.toMatch(/^\s+version\s/m);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
