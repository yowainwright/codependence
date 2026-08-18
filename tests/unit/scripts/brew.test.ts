import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertRejects, assertThrows } from "../../helpers/assertions";
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
} from "../../../scripts/release/brew";

describe("scripts/release/brew", () => {
  test("builds the published npm tarball URL", () => {
    const url = "https://registry.npmjs.org/codependence/-/codependence-1.1.0.tgz";
    assert.strictEqual((npmTarballUrl("1.1.0")), url);
  });

  test("accepts only stable versions", () => {
    assert.doesNotThrow((() => validateStableVersion("1.1.0")));
    assertThrows((() => validateStableVersion("1.1.0-beta.1")), "Invalid stable version");
    assertThrows((() => validateStableVersion("v1.1.0")), "Invalid stable version");
  });

  test("rejects prereleases before generating", async () => {
    const options = { argv: ["validate-version"], env: { VERSION: "1.1.0-rc.0" } };
    await assertRejects(runBrewCli(options), "Invalid stable version");
  });

  test("downloads published tarball bytes", async () => {
    const fetchImpl = async () => new Response("published tarball");
    const tarball = await fetchPublishedTarball(npmTarballUrl("1.1.0"), fetchImpl);
    assert.deepStrictEqual((tarball), Buffer.from("published tarball"));
  });

  test("rejects unavailable published tarballs", async () => {
    const fetchImpl = async () => new Response(null, { status: 404 });
    const download = fetchPublishedTarball(npmTarballUrl("1.1.0"), fetchImpl);
    await assertRejects(download, "Unable to download published tarball: 404");
  });

  test("computes a hexadecimal SHA256", () => {
    const digest = sha256(Buffer.from("hello"));
    assert.strictEqual((digest).length, 64);
    assert.match((digest), /^[a-f0-9]+$/);
  });

  test("renders a Node-backed formula", () => {
    const formula = renderFormula({ digest: "abc123", url: npmTarballUrl("1.1.0") });
    assert.doesNotMatch((formula), /^\s+version\s/m);
    assert.ok((formula).includes('depends_on "node"'));
    assert.ok((formula).includes('system bin/"codependence", "--help"'));
    assert.ok((formula).includes('system bin/"cdp", "--help"'));
  });

  test("generates a formula from a local tarball", () => {
    const directory = mkdtempSync(join(tmpdir(), "codependence-brew-"));
    const outputPath = join(directory, "codependence.rb");
    const tarballPath = join(directory, "codependence.tgz");
    try {
      writeFileSync(tarballPath, "local tarball");
      const formula = createLocalFormula({ outputPath, tarballPath, version: "1.1.0" });
      assert.strictEqual((formula.digest), sha256(Buffer.from("local tarball")));
      assert.doesNotMatch((readFileSync(outputPath, "utf8")), /^\s+version\s/m);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
