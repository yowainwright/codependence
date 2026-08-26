import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { HelmProvider } from "../../../../src/providers/helm";

describe("HelmProvider", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-helm-test");
  const chartDir = join(tmpDir, "payments");
  const chartPath = join(chartDir, "Chart.yaml");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(chartDir, { recursive: true });
  });

  test("should expose provider metadata", () => {
    const provider = new HelmProvider();

    assert.strictEqual(provider.language, "helm");
    assert.deepStrictEqual(provider.capabilities, {
      supportsLatestResolution: false,
      supportsPreciseMode: false,
      versionStrategy: "semver",
    });
    assert.strictEqual(provider.validatePackageName("bitnami/redis"), true);
    assert.strictEqual(provider.validatePackageName("bad chart"), false);
  });

  test("should read Chart.yaml dependency versions", () => {
    const content = `apiVersion: v2
name: chart-name
version: 1.0.0
appVersion: "2.0.0"
dependencies:
  - name: redis
    version: 20.6.3
    repository: https://charts.bitnami.com/bitnami
  - name: postgresql
    repository: https://charts.bitnami.com/bitnami
    version: "15.1.0"
`;
    writeFileSync(chartPath, content);
    const provider = new HelmProvider();

    assert.deepStrictEqual(provider.readManifest(chartPath), {
      filePath: chartPath,
      name: "payments",
      version: "1.0.0",
      dependencies: {
        postgresql: "15.1.0",
        redis: "20.6.3",
      },
    });
  });

  test("should update Chart.yaml dependency versions and preserve unrelated content", () => {
    const content = `apiVersion: v2
name: chart-name
version: 1.0.0
appVersion: "2.0.0"
dependencies:
  - name: redis # cache chart
    version: 20.6.3 # keep suffix
    repository: https://charts.bitnami.com/bitnami
`;
    writeFileSync(chartPath, content);
    const provider = new HelmProvider();

    provider.writeManifest(chartPath, {
      filePath: chartPath,
      name: "payments",
      version: "1.0.0",
      dependencies: { redis: "20.7.0" },
    });

    assert.strictEqual(
      readFileSync(chartPath, "utf8"),
      `apiVersion: v2
name: chart-name
version: 1.0.0
appVersion: "2.0.0"
dependencies:
  - name: redis # cache chart
    version: 20.7.0 # keep suffix
    repository: https://charts.bitnami.com/bitnami
`,
    );
  });

  test("should read and update explicit values image tags", () => {
    const valuesPath = join(chartDir, "values.yaml");
    const content = `image:
  registry: docker.io
  repository: bitnami/nginx
  tag: "1.27.0" # deployed image
sidecar:
  image:
    repository: redis
    tag: 7.2.4
templated:
  image:
    repository: "{{ .Values.image.repository }}"
    tag: latest
`;
    writeFileSync(valuesPath, content);
    const provider = new HelmProvider();

    assert.deepStrictEqual(provider.readManifest(valuesPath), {
      filePath: valuesPath,
      name: "payments",
      dependencies: {
        "docker.io/bitnami/nginx": "1.27.0",
        redis: "7.2.4",
      },
      dependencyVersions: {
        "docker.io/bitnami/nginx": ["1.27.0"],
        redis: ["7.2.4"],
      },
    });

    provider.writeManifest(valuesPath, {
      filePath: valuesPath,
      dependencies: {
        "docker.io/bitnami/nginx": "1.27.1",
        redis: "7.2.5",
      },
    });

    assert.strictEqual(
      readFileSync(valuesPath, "utf8"),
      `image:
  registry: docker.io
  repository: bitnami/nginx
  tag: "1.27.1" # deployed image
sidecar:
  image:
    repository: redis
    tag: 7.2.5
templated:
  image:
    repository: "{{ .Values.image.repository }}"
    tag: latest
`,
    );
  });

  test("should ignore non-image repository tag mappings in values", () => {
    const valuesPath = join(chartDir, "values.yaml");
    const content = `chartRepository:
  repository: https://charts.bitnami.com/bitnami
  tag: stable
image:
  repository: bitnami/nginx
  tag: "1.27.0"
  metadata:
    repository: ignored/repo
    tag: 9.9.9
`;
    writeFileSync(valuesPath, content);
    const provider = new HelmProvider();

    assert.deepStrictEqual(provider.readManifest(valuesPath), {
      filePath: valuesPath,
      name: "payments",
      dependencies: {
        "bitnami/nginx": "1.27.0",
      },
      dependencyVersions: {
        "bitnami/nginx": ["1.27.0"],
      },
    });

    provider.writeManifest(valuesPath, {
      filePath: valuesPath,
      dependencies: {
        "bitnami/nginx": "1.27.1",
        "https://charts.bitnami.com/bitnami": "latest",
        "ignored/repo": "10.0.0",
      },
    });

    assert.strictEqual(
      readFileSync(valuesPath, "utf8"),
      `chartRepository:
  repository: https://charts.bitnami.com/bitnami
  tag: stable
image:
  repository: bitnami/nginx
  tag: "1.27.1"
  metadata:
    repository: ignored/repo
    tag: 9.9.9
`,
    );
  });
});
