import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertRejects, assertThrows } from "../../helpers/assertions";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkHomebrewReleaseState,
  createLocalFormula,
  extractFormulaVersion,
  fetchPublishedTarball,
  npmTarballUrl,
  renderFormula,
  runBrewCli,
  sha256,
  updateHomebrewTap,
  validateStableVersion,
} from "../../../scripts/release";

type GithubCall = { body?: unknown; method: string; url: string };

describe("scripts/release brew", () => {
  const stateEnv = {
    FORMULA_PATH: "codependence.rb",
    GITHUB_REPOSITORY: "yowainwright/codependence",
    GITHUB_TOKEN: "repo-token",
    TAP_TOKEN: "tap-token",
    VERSION: "1.0.11",
  };

  test("builds the published npm tarball URL", () => {
    const url = "https://registry.npmjs.org/codependence/-/codependence-1.1.0.tgz";
    assert.strictEqual((npmTarballUrl("1.1.0")), url);
  });

  test("accepts only stable versions", () => {
    assert.doesNotThrow((() => validateStableVersion("1.1.0")));
    assertThrows((() => validateStableVersion("1.1.0-beta.1")), "Invalid stable version");
    assertThrows((() => validateStableVersion("v1.1.0")), "Invalid stable version");
  });

  test("reads the formula tarball version", () => {
    const formula = 'url "https://registry.npmjs.org/codependence/-/codependence-1.0.12.tgz"';
    assert.strictEqual(extractFormulaVersion(formula), "1.0.12");
  });

  test("skips when the Homebrew tap already has a newer version", async () => {
    const fetchImpl = async () => new Response(
      'url "https://registry.npmjs.org/codependence/-/codependence-1.0.12.tgz"',
    );
    const state = await checkHomebrewReleaseState({ arch: "arm64", env: stateEnv, fetchImpl });
    assert.deepStrictEqual(state, {
      reason: "Homebrew tap already has newer codependence 1.0.12; skipping 1.0.11",
      skip: true,
    });
  });

  test("skips when the same Homebrew release is already complete", async () => {
    const formula = 'url "https://registry.npmjs.org/codependence/-/codependence-1.0.11.tgz"';
    const release = {
      assets: [
        { name: "codependence.rb" },
        { name: "codependence-darwin-arm64" },
        { name: "codependence-darwin-arm64.sigstore.json" },
      ],
      draft: false,
    };
    const fetchImpl = async (url: URL | RequestInfo) =>
      new Response(String(url).includes("homebrew-tap") ? formula : JSON.stringify(release));
    const state = await checkHomebrewReleaseState({ arch: "arm64", env: stateEnv, fetchImpl });
    assert.deepStrictEqual(state, {
      reason: "Homebrew formula and release assets already published for 1.0.11",
      skip: true,
    });
  });

  test("continues when the tap is behind the requested version", async () => {
    const env = Object.assign({}, stateEnv, { VERSION: "1.0.12" });
    const fetchImpl = async () => new Response(
      'url "https://registry.npmjs.org/codependence/-/codependence-1.0.11.tgz"',
    );
    const state = await checkHomebrewReleaseState({ arch: "arm64", env, fetchImpl });
    assert.deepStrictEqual(state, { skip: false });
  });

  test("updates the existing stable Homebrew tap PR", async () => {
    const directory = mkdtempSync(join(tmpdir(), "codependence-brew-tap-"));
    const formulaPath = join(directory, "codependence.rb");
    let calls: GithubCall[] = [];
    try {
      writeFileSync(formulaPath, "new formula");
      const env = Object.assign({}, stateEnv, {
        FORMULA_PATH: formulaPath,
        TAP_BRANCH: "codependence-release",
        VERSION: "1.0.13",
      });
      const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const method = init?.method || "GET";
        calls = calls.concat({ body, method, url: String(url) });
        return brewTapResponse(String(url), init?.method || "GET");
      };
      const result = await updateHomebrewTap({ env, fetchImpl });

      assert.deepStrictEqual(result, {
        branch: "codependence-release",
        changed: true,
        pullRequestUrl: "https://github.com/yowainwright/homebrew-tap/pull/10",
      });
      assert.ok(calls.some((call) => call.method === "PATCH" && call.url.includes("git/refs")));
      assert.ok(calls.some((call) => call.method === "PUT" && call.url.includes("contents")));
      assert.ok(calls.some((call) => call.method === "PATCH" && call.url.includes("pulls/10")));
      assert.ok(!calls.some((call) => call.method === "POST" && call.url.endsWith("/pulls")));
    } finally {
      rmSync(directory, { recursive: true });
    }
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

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const brewTapResponse = (url: string, method: string): Response => {
  const isFormulaRead =
    method === "GET" && url.includes("contents/Formula/codependence.rb") && !url.includes("ref=");
  if (isFormulaRead) {
    return new Response("old formula");
  }
  if (url.includes("git/ref/heads/main")) return jsonResponse({ object: { sha: "main-sha" } });
  if (url.includes("git/ref/heads/codependence-release")) {
    return jsonResponse({ object: { sha: "branch-sha" } });
  }
  const isFormulaRefRead = url.includes("contents/Formula/codependence.rb") && url.includes("ref=");
  if (isFormulaRefRead) {
    return jsonResponse({ sha: "formula-sha" });
  }
  if (url.includes("pulls?")) {
    return jsonResponse([
      { html_url: "https://github.com/yowainwright/homebrew-tap/pull/10", number: 10 },
    ]);
  }
  const writeMethods = new Set(["PATCH", "POST", "PUT"]);
  const isWriteMethod = writeMethods.has(method);
  if (isWriteMethod) return jsonResponse({});
  return jsonResponse({}, 404);
};
