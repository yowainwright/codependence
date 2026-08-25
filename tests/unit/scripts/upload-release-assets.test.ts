import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(
  new URL("../../../scripts/upload-release-assets.sh", import.meta.url),
);
const FAKE_GH = `#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_GH_LOG"
if [ "$1" = "api" ] && [ "$2" = "--paginate" ]; then
  printf '%s' "$FAKE_RELEASE_JSON"
  exit 0
fi
if [ "$1" = "api" ] && [ "$2" = "--header" ]; then
  printf '%s' "$FAKE_ASSET_BODY"
  exit 0
fi
`;
const RELEASE_ID = 123;
const UPLOAD_URL =
  "https://uploads.github.com/repos/yowainwright/codependence/releases/123/assets{?name,label}";
const tempDirectories = new Set<string>();

type Fixture = { assetPath: string; env: NodeJS.ProcessEnv; logPath: string };
type FixtureOptions = {
  assetContent?: string;
  assetName?: string;
  existingAssetBody?: string;
  publishedDigest?: string | null;
  releaseExists?: boolean;
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

function createEnvironment(
  binPath: string,
  logPath: string,
  releaseJson: string,
  assetBody = "",
) {
  const path = `${binPath}:${process.env.PATH ?? ""}`;
  return Object.assign({}, process.env, {
    FAKE_ASSET_BODY: assetBody,
    FAKE_GH_LOG: logPath,
    FAKE_RELEASE_JSON: releaseJson,
    GITHUB_REPOSITORY: "yowainwright/codependence",
    PATH: path,
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
}: FixtureOptions = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "codependence-release-assets-"));
  const binPath = join(root, "bin");
  const assetPath = join(root, assetName);
  const logPath = join(root, "gh.log");
  const assets =
    publishedDigest === undefined ? [] : [{ name: assetName, digest: publishedDigest }];
  tempDirectories.add(root);
  mkdirSync(binPath);
  writeFileSync(assetPath, assetContent);
  writeFileSync(logPath, "");
  writeFileSync(join(binPath, "gh"), FAKE_GH);
  chmodSync(join(binPath, "gh"), 0o755);
  const releaseJson = createReleaseJson(assets, releaseExists);
  const env = createEnvironment(binPath, logPath, releaseJson, existingAssetBody);
  return { assetPath, env, logPath };
}

function createFixture(publishedDigest?: string | null, releaseExists = true): Fixture {
  return createFixtureWithOptions({ publishedDigest, releaseExists });
}

const runUpload = ({ assetPath, env }: Fixture) =>
  spawnSync("sh", [SCRIPT_PATH, "v1.2.3", assetPath], { encoding: "utf8", env });

afterEach(() => {
  tempDirectories.forEach((directory) => rmSync(directory, { recursive: true }));
  tempDirectories.clear();
});

describe("scripts/upload-release-assets", () => {
  test("uploads a missing asset", () => {
    const fixture = createFixture();
    const result = runUpload(fixture);
    const log = readFileSync(fixture.logPath, "utf8");
    assert.strictEqual((result.status), 0);
    assert.strictEqual((result.stdout), "123\n");
    assert.ok((log).includes("api --paginate --slurp"));
    assert.ok((log).includes("api --method POST"));
    assert.ok((log).includes("releases/123/assets?name=codependence.tgz"));
  });

  test("skips an existing asset with the expected digest", () => {
    const digest = createHash("sha256").update("release asset").digest("hex");
    const fixture = createFixture(`sha256:${digest}`);
    const result = runUpload(fixture);
    const log = readFileSync(fixture.logPath, "utf8");
    assert.strictEqual((result.status), 0);
    assert.strictEqual((result.stdout), "123\n");
    assert.ok(!(log).includes("api --method POST"));
  });

  test("rejects an existing asset with a different digest", () => {
    const fixture = createFixture("sha256:unexpected");
    const result = runUpload(fixture);
    const log = readFileSync(fixture.logPath, "utf8");
    assert.strictEqual((result.status), 1);
    assert.ok((result.stderr).includes("Release asset digest mismatch: codependence.tgz"));
    assert.ok(!(log).includes("api --method POST"));
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
    const log = readFileSync(fixture.logPath, "utf8");
    assert.strictEqual((result.status), 0);
    assert.strictEqual((result.stdout), "123\n");
    assert.ok((log).includes("api --header Accept: application/octet-stream"));
    assert.ok(!(log).includes("api --method POST"));
  });

  test("rejects an existing Sigstore bundle with a different subject digest", () => {
    const fixture = createFixtureWithOptions({
      assetContent: createSigstoreBundle("a".repeat(64), "retry"),
      assetName: "codependence-darwin-arm64.sigstore.json",
      existingAssetBody: createSigstoreBundle("b".repeat(64), "published"),
      publishedDigest: "sha256:unexpected",
    });
    const result = runUpload(fixture);
    assert.strictEqual((result.status), 1);
    assert.ok((result.stderr).includes(
      "Release attestation subject digest mismatch: codependence-darwin-arm64.sigstore.json",
    ));
  });

  test("rejects an existing asset without a published digest", () => {
    const fixture = createFixture(null);
    const result = runUpload(fixture);
    assert.strictEqual((result.status), 1);
    assert.ok((result.stderr).includes("Release asset digest unavailable: codependence.tgz"));
  });

  test("rejects a missing release", () => {
    const fixture = createFixture(undefined, false);
    const result = runUpload(fixture);
    assert.strictEqual((result.status), 1);
    assert.ok((result.stderr).includes("Release not found: v1.2.3"));
  });
});
