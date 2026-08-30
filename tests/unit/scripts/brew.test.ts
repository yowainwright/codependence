import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { assertRejects, assertThrows } from "../../helpers/assertions";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkHomebrewReleaseState,
  createLocalFormula,
  createPublishedFormula,
  extractFormulaVersion,
  fetchPublishedTarball,
  npmTarballUrl,
  renderFormula,
  runBrewCli,
  sha256,
  updateHomebrewTap,
  writeHomebrewReleaseState,
  writeHomebrewTapUpdate,
  validateStableVersion,
} from "../../../scripts/release";

type GithubCall = { body?: unknown; method: string; url: string };
const TEMP_ROOT = join(import.meta.dirname, ".tmp-brew");

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

  test("continues when the matching release has missing assets", async () => {
    const formula = 'url "https://registry.npmjs.org/codependence/-/codependence-1.0.11.tgz"';
    const release = { assets: [{ name: "codependence.rb" }], draft: false };
    const fetchImpl = async (url: URL | RequestInfo) =>
      new Response(String(url).includes("homebrew-tap") ? formula : JSON.stringify(release));
    const state = await checkHomebrewReleaseState({ arch: "arm64", env: stateEnv, fetchImpl });
    assert.deepStrictEqual(state, { skip: false });
  });

  test("continues when the matching release is not found", async () => {
    const formula = 'url "https://registry.npmjs.org/codependence/-/codependence-1.0.11.tgz"';
    const fetchImpl = async (url: URL | RequestInfo) => {
      if (String(url).includes("homebrew-tap")) return new Response(formula);
      return new Response(null, { status: 404 });
    };
    const state = await checkHomebrewReleaseState({ arch: "arm64", env: stateEnv, fetchImpl });
    assert.deepStrictEqual(state, { skip: false });
  });

  test("updates the existing stable Homebrew tap PR", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "tap-"));
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
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("creates a Homebrew tap PR when none is open", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "tap-create-"));
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
        return brewTapResponseWithoutOpenPr(String(url), method);
      };
      const result = await updateHomebrewTap({ env, fetchImpl });

      assert.deepStrictEqual(result, {
        branch: "codependence-release",
        changed: true,
        pullRequestUrl: "https://github.com/yowainwright/homebrew-tap/pull/11",
      });
      assert.ok(calls.some((call) => call.method === "POST" && call.url.endsWith("/pulls")));
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("does not update the Homebrew tap when formula content matches", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "tap-current-"));
    const formulaPath = join(directory, "codependence.rb");
    try {
      writeFileSync(formulaPath, "same formula");
      const env = Object.assign({}, stateEnv, { FORMULA_PATH: formulaPath });
      const fetchImpl = async () => new Response("same formula");
      const result = await updateHomebrewTap({ env, fetchImpl });
      assert.deepStrictEqual(result, { changed: false });
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
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

  test("generates a formula from published tarball bytes", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "published-"));
    const outputPath = join(directory, "codependence.rb");
    try {
      const fetchImpl = async () => new Response("published tarball");
      const formula = await createPublishedFormula({ fetchImpl, outputPath, version: "1.1.0" });
      assert.strictEqual((formula.digest), sha256(Buffer.from("published tarball")));
      assert.ok((readFileSync(outputPath, "utf8")).includes(formula.digest));
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
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
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "local-"));
    const outputPath = join(directory, "codependence.rb");
    const tarballPath = join(directory, "codependence.tgz");
    try {
      writeFileSync(tarballPath, "local tarball");
      const formula = createLocalFormula({ outputPath, tarballPath, version: "1.1.0" });
      assert.strictEqual((formula.digest), sha256(Buffer.from("local tarball")));
      assert.doesNotMatch((readFileSync(outputPath, "utf8")), /^\s+version\s/m);
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("runs Homebrew CLI generate-local", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "cli-local-"));
    const outputPath = join(directory, "codependence.rb");
    const tarballPath = join(directory, "codependence.tgz");
    try {
      writeFileSync(tarballPath, "local tarball");
      await runBrewCli({
        argv: ["generate-local"],
        env: { FORMULA_PATH: outputPath, TARBALL_PATH: tarballPath, VERSION: "1.1.0" },
      });
      assert.ok((readFileSync(outputPath, "utf8")).includes(npmTarballUrl("1.1.0")));
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("runs Homebrew CLI generate", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "cli-published-"));
    const outputPath = join(directory, "codependence.rb");
    try {
      const fetchImpl = async () => new Response("published tarball");
      await runBrewCli({
        argv: ["generate"],
        env: { FORMULA_PATH: outputPath, VERSION: "1.1.0" },
        fetchImpl,
      });
      assert.ok((readFileSync(outputPath, "utf8")).includes(npmTarballUrl("1.1.0")));
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("writes Homebrew release state output", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "state-"));
    const outputPath = join(directory, "github-output");
    const formula = 'url "https://registry.npmjs.org/codependence/-/codependence-1.0.12.tgz"';
    const fetchImpl = async () => new Response(formula);
    const writeSpy = mock.method(process.stdout, "write", () => true);
    try {
      await writeHomebrewReleaseState({
        arch: "arm64",
        env: Object.assign({}, stateEnv, { GITHUB_OUTPUT: outputPath }),
        fetchImpl,
      });
      assert.strictEqual((readFileSync(outputPath, "utf8")), "skip=true\n");
    } finally {
      writeSpy.mock.restore();
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("writes Homebrew tap update output", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "tap-output-"));
    const formulaPath = join(directory, "codependence.rb");
    const outputPath = join(directory, "github-output");
    const writeSpy = mock.method(process.stdout, "write", () => true);
    try {
      writeFileSync(formulaPath, "new formula");
      const env = Object.assign({}, stateEnv, {
        FORMULA_PATH: formulaPath,
        GITHUB_OUTPUT: outputPath,
        TAP_BRANCH: "codependence-release",
        VERSION: "1.0.13",
      });
      const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) =>
        brewTapResponse(String(url), init?.method || "GET");
      await writeHomebrewTapUpdate({ env, fetchImpl });
      assert.strictEqual(
        (readFileSync(outputPath, "utf8")),
        "tap-pr-url=https://github.com/yowainwright/homebrew-tap/pull/10\n",
      );
    } finally {
      writeSpy.mock.restore();
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("rejects unknown Homebrew CLI commands", async () => {
    await assertRejects(runBrewCli({ argv: ["wat"], env: { VERSION: "1.1.0" } }), "Unknown command");
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

const brewTapResponseWithoutOpenPr = (url: string, method: string): Response => {
  const isPullsRead = method === "GET" && url.includes("pulls?");
  if (isPullsRead) return jsonResponse([]);
  const isPullCreate = method === "POST" && url.endsWith("/pulls");
  if (isPullCreate) {
    return jsonResponse({ html_url: "https://github.com/yowainwright/homebrew-tap/pull/11" });
  }
  return brewTapResponse(url, method);
};
