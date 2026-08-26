import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { KubernetesProvider } from "../../../../src/providers/kubernetes";

describe("KubernetesProvider", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-kubernetes-test");
  const projectDir = join(tmpDir, "api");
  const manifestDir = join(projectDir, "k8s");
  const manifestPath = join(manifestDir, "deployment.yaml");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(manifestDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new KubernetesProvider();

    assert.strictEqual(provider.language, "kubernetes");
    assert.deepStrictEqual(provider.capabilities, {
      supportsLatestResolution: false,
      supportsPreciseMode: false,
      versionStrategy: "exact",
    });
    assert.strictEqual(provider.validatePackageName("ghcr.io/acme/web"), true);
    assert.strictEqual(provider.validatePackageName("bad image"), false);
    await assert.rejects(() => provider.getLatestVersion("nginx"), /Kubernetes provider/);
    await assert.rejects(() => provider.getAllVersions("nginx"), /Kubernetes provider/);
  });

  test("should read container and init-container image tags", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      initContainers:
        - name: init
          image: busybox:1.36.1
      containers:
        - name: app
          image: ghcr.io/acme/web:2.4.0
        - name: templated
          image: "{{ .Values.image }}"
        - name: untagged
          image: nginx
`;
    writeFileSync(manifestPath, content);
    const provider = new KubernetesProvider();

    assert.deepStrictEqual(provider.readManifest(manifestPath), {
      filePath: manifestPath,
      name: "api",
      dependencies: {
        busybox: "1.36.1",
        "ghcr.io/acme/web": "2.4.0",
      },
      dependencyVersions: {
        busybox: ["1.36.1"],
        "ghcr.io/acme/web": ["2.4.0"],
      },
    });
  });

  test("should update image tags and preserve comments", () => {
    const content = `containers:
  - name: app
    image: "ghcr.io/acme/web:2.4.0" # app image
initContainers:
  - name: init
    image: busybox:1.36.1
`;
    writeFileSync(manifestPath, content);
    const provider = new KubernetesProvider();

    provider.writeManifest(manifestPath, {
      filePath: manifestPath,
      dependencies: {
        busybox: "1.36.2",
        "ghcr.io/acme/web": "2.5.0",
      },
    });

    assert.strictEqual(
      readFileSync(manifestPath, "utf8"),
      `containers:
  - name: app
    image: "ghcr.io/acme/web:2.5.0" # app image
initContainers:
  - name: init
    image: busybox:1.36.2
`,
    );
  });

  test("should update image tags through resolved versions", () => {
    const content = `containers:
  - name: app
    image: ghcr.io/acme/web:2.4.0
`;
    writeFileSync(manifestPath, content);
    const provider = new KubernetesProvider();

    provider.writeManifest(manifestPath, {
      filePath: manifestPath,
      dependencies: {},
      resolvedDependencyVersions: {
        "ghcr.io/acme/web": {
          "2.4.0": "2.5.0",
        },
      },
    });

    assert.strictEqual(
      readFileSync(manifestPath, "utf8"),
      `containers:
  - name: app
    image: ghcr.io/acme/web:2.5.0
`,
    );
  });
});
