import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { KustomizeProvider } from "../../../../src/providers/kustomize";

const DIGEST = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const NEXT_DIGEST = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("KustomizeProvider", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-kustomize-test");
  const manifestDir = join(tmpDir, "prod");
  const manifestPath = join(manifestDir, "kustomization.yaml");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(manifestDir, { recursive: true });
  });

  test("should read image newName, newTag, and digest entries", () => {
    const content = `resources:
  - deployment.yaml
images:
  - name: busybox
    newName: alpine
    newTag: 3.19
  - name: ghcr.io/acme/web
    digest: ${DIGEST}
  - name: templated
    newTag: "{{ .Values.tag }}"
`;
    writeFileSync(manifestPath, content);
    const provider = new KustomizeProvider();

    assert.deepStrictEqual(provider.readManifest(manifestPath), {
      filePath: manifestPath,
      name: "prod",
      dependencies: {
        alpine: "3.19",
        "ghcr.io/acme/web": DIGEST,
      },
      dependencyVersions: {
        alpine: ["3.19"],
        "ghcr.io/acme/web": [DIGEST],
      },
    });
  });

  test("should update newTag and digest fields", () => {
    const content = `images:
  - name: busybox
    newName: alpine
    newTag: "3.19" # tag
  - name: ghcr.io/acme/web
    digest: ${DIGEST} # digest
`;
    writeFileSync(manifestPath, content);
    const provider = new KustomizeProvider();

    provider.writeManifest(manifestPath, {
      filePath: manifestPath,
      dependencies: {
        alpine: "3.20",
        "ghcr.io/acme/web": NEXT_DIGEST,
      },
    });

    assert.strictEqual(
      readFileSync(manifestPath, "utf8"),
      `images:
  - name: busybox
    newName: alpine
    newTag: "3.20" # tag
  - name: ghcr.io/acme/web
    digest: ${NEXT_DIGEST} # digest
`,
    );
  });
});
