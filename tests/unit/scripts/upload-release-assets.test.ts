import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runUploadReleaseAssetsCli } from "../../../scripts/release";
import type { GitResult, ReleaseRunner } from "../../../scripts/release";

const RELEASE_ID = 123;
const UPLOAD_URL =
  "https://uploads.github.com/repos/yowainwright/codependence/releases/123/assets{?name,label}";
const TEMP_ROOT = join(import.meta.dirname, ".tmp-release-assets");
const tempDirectories = new Set<string>();

type Fixture = {
  assetPath: string;
  assetBody: string;
  env: NodeJS.ProcessEnv;
  log: string[];
  releaseJson: string;
};
type FixtureOptions = {
  assetContent?: string;
  assetName?: string;
  existingAssetBody?: string;
  publishedDigest?: string | null;
  releaseExists?: boolean;
  uploadUrl?: string;
};

function createReleaseJson(
  assets: Array<{ digest: string | null; name: string }>,
  exists: boolean,
) {
  if (!exists) return JSON.stringify([[]]);
  const release = {
    assets: assets.map((asset, index) => ({
      ...asset,
      url: `https://api.github.com/repos/yowainwright/codependence/releases/assets/${index + 1}`,
    })),
    draft: true,
    id: RELEASE_ID,
    tag_name: "v1.2.3",
    upload_url: UPLOAD_URL,
  };
  return JSON.stringify([[release]]);
}

function createEnvironment(releaseJson: string, assetBody: string) {
  return Object.assign({}, process.env, {
    FAKE_ASSET_BODY: assetBody,
    FAKE_RELEASE_JSON: releaseJson,
    GITHUB_REPOSITORY: "yowainwright/codependence",
  });
}

function createSigstoreBundle(subjectDigest: string, marker: string) {
  const statement = {
    predicate: { marker },
    subject: [{ digest: { sha256: subjectDigest }, name: "codependence-darwin-arm64" }],
  };
  const payload = Buffer.from(JSON.stringify(statement)).toString("base64");
  return JSON.stringify({ dsseEnvelope: { payload }, verificationMaterial: { marker } });
}

function createFixtureWithOptions({
  assetContent = "release asset",
  assetName = "codependence.tgz",
  existingAssetBody = "",
  publishedDigest,
  releaseExists = true,
  uploadUrl = UPLOAD_URL,
}: FixtureOptions = {}): Fixture {
  mkdirSync(TEMP_ROOT, { recursive: true });
  const root = mkdtempSync(join(TEMP_ROOT, "fixture-"));
  const assetPath = join(root, assetName);
  const assets =
    publishedDigest === undefined ? [] : [{ name: assetName, digest: publishedDigest }];
  tempDirectories.add(root);
  writeFileSync(assetPath, assetContent);
  const releaseJson = createReleaseJson(assets, releaseExists).replace(UPLOAD_URL, uploadUrl);
  const env = createEnvironment(releaseJson, existingAssetBody);
  return { assetPath, assetBody: existingAssetBody, env, log: [], releaseJson };
}

function createFixture(publishedDigest?: string | null, releaseExists = true): Fixture {
  return createFixtureWithOptions({ publishedDigest, releaseExists });
}

function runUpload(fixture: Fixture) {
  let stdout: string[] = [];
  const runner = createRunner(fixture);
  const logger = {
    log(value: unknown) {
      stdout = stdout.concat(String(value));
    },
  };

  try {
    const status = runUploadReleaseAssetsCli({
      argv: ["v1.2.3", fixture.assetPath],
      env: fixture.env,
      logger,
      runner,
    });
    return { status, stderr: "", stdout: `${stdout.join("\n")}\n` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 1, stderr: message, stdout: stdout.join("\n") };
  }
}

function createRunner(fixture: Fixture): ReleaseRunner {
  return (command, args) => {
    const line = [command].concat(Array.from(args)).join(" ");
    fixture.log = fixture.log.concat(line);
    return runnerResult(fixture, args);
  };
}

function runnerResult(fixture: Fixture, args: readonly string[]): GitResult {
  const readsReleases = args.includes("--paginate");
  if (readsReleases) return { status: 0, stdout: fixture.releaseJson, stderr: "" };

  const readsAsset = args.includes("Accept: application/octet-stream");
  if (readsAsset) return { status: 0, stdout: fixture.assetBody, stderr: "" };

  return { status: 0, stdout: "", stderr: "" };
}

afterEach(() => {
  tempDirectories.forEach((directory) => rmSync(directory, { recursive: true }));
  tempDirectories.clear();
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("scripts/release assets", () => {
  test("uploads a missing asset", () => {
    const fixture = createFixture();
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, "123\n");
    assert.ok(fixture.log.some((line) => line.includes("api --paginate --slurp")));
    assert.ok(fixture.log.some((line) => line.includes("api --method POST")));
    assert.ok(
      fixture.log.some((line) => line.includes("releases/123/assets?name=codependence.tgz")),
    );
  });

  test("skips an existing asset with the expected digest", () => {
    const digest = createHash("sha256").update("release asset").digest("hex");
    const fixture = createFixture(`sha256:${digest}`);
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, "123\n");
    assert.ok(!fixture.log.some((line) => line.includes("api --method POST")));
  });

  test("rejects an existing asset with a different digest", () => {
    const fixture = createFixture("sha256:unexpected");
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes("Release asset digest mismatch: codependence.tgz"));
    assert.ok(!fixture.log.some((line) => line.includes("api --method POST")));
  });

  test("skips an existing Sigstore bundle with the same subject digest", () => {
    const subjectDigest = "a".repeat(64);
    const fixture = createFixtureWithOptions({
      assetContent: createSigstoreBundle(subjectDigest, "retry"),
      assetName: "codependence-darwin-arm64.sigstore.json",
      existingAssetBody: createSigstoreBundle(subjectDigest, "published"),
      publishedDigest: "sha256:unexpected",
    });
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, "123\n");
    assert.ok(
      fixture.log.some((line) => line.includes("api --header Accept: application/octet-stream")),
    );
    assert.ok(!fixture.log.some((line) => line.includes("api --method POST")));
  });

  test("rejects an existing Sigstore bundle with a different subject digest", () => {
    const fixture = createFixtureWithOptions({
      assetContent: createSigstoreBundle("a".repeat(64), "retry"),
      assetName: "codependence-darwin-arm64.sigstore.json",
      existingAssetBody: createSigstoreBundle("b".repeat(64), "published"),
      publishedDigest: "sha256:unexpected",
    });
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "Release attestation subject digest mismatch: codependence-darwin-arm64.sigstore.json",
      ),
    );
  });

  test("rejects an existing asset without a published digest", () => {
    const fixture = createFixture(null);
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes("Release asset digest unavailable: codependence.tgz"));
  });

  test("rejects a missing release", () => {
    const fixture = createFixture(undefined, false);
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes("Release not found: v1.2.3"));
  });

  test("rejects an unexpected release upload URL", () => {
    const fixture = createFixtureWithOptions({
      uploadUrl: "https://uploads.github.com/repos/other/project/releases/123/assets{?name,label}",
    });
    const result = runUpload(fixture);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes("Unexpected release upload URL"));
  });

  test("rejects missing CLI arguments", () => {
    assert.throws(
      () => runUploadReleaseAssetsCli({ argv: [], env: {} }),
      /Release tag is required/,
    );
    assert.throws(
      () => runUploadReleaseAssetsCli({ argv: ["v1.2.3"], env: {} }),
      /At least one release asset is required/,
    );
  });
});
