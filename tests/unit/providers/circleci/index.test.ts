import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { CircleCIProvider } from "../../../../src/providers/circleci";

describe("CircleCIProvider", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-circleci-test");
  const projectDir = join(tmpDir, "web");
  const configDir = join(projectDir, ".circleci");
  const configPath = join(configDir, "config.yml");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(configDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new CircleCIProvider();

    assert.strictEqual(provider.language, "circleci");
    assert.deepStrictEqual(provider.capabilities, {
      supportsLatestResolution: false,
      supportsPreciseMode: false,
      versionStrategy: "exact",
    });
    assert.strictEqual(provider.validatePackageName("circleci/node"), true);
    assert.strictEqual(provider.validatePackageName("bad orb"), false);
    await assert.rejects(() => provider.getLatestVersion("circleci/node"), /CircleCI provider/);
    await assert.rejects(() => provider.getAllVersions("circleci/node"), /CircleCI provider/);
  });

  test("should read orb versions and executor image tags", () => {
    const content = `version: 2.1
orbs:
  node: circleci/node@7.1.0
  inline:
    commands: {}
jobs:
  test:
    docker:
      - image: cimg/node:22.11
      - image: cimg/base
      - image: "<< parameters.image >>"
`;
    writeFileSync(configPath, content);
    const provider = new CircleCIProvider();

    assert.deepStrictEqual(provider.readManifest(configPath), {
      filePath: configPath,
      name: "web",
      dependencies: {
        "cimg/node": "22.11",
        "circleci/node": "7.1.0",
      },
      dependencyVersions: {
        "cimg/node": ["22.11"],
        "circleci/node": ["7.1.0"],
      },
    });
  });

  test("should update orb versions and image tags", () => {
    const content = `version: 2.1
orbs:
  node: circleci/node@7.1.0 # orb
jobs:
  test:
    docker:
      - image: "cimg/node:22.11" # image
`;
    writeFileSync(configPath, content);
    const provider = new CircleCIProvider();

    provider.writeManifest(configPath, {
      filePath: configPath,
      dependencies: {
        "cimg/node": "22.12",
        "circleci/node": "7.2.0",
      },
    });

    assert.strictEqual(
      readFileSync(configPath, "utf8"),
      `version: 2.1
orbs:
  node: circleci/node@7.2.0 # orb
jobs:
  test:
    docker:
      - image: "cimg/node:22.12" # image
`,
    );
  });

  test("should ignore templated or malformed orb references", () => {
    const content = `version: 2.1
orbs:
  templated: "<< pipeline.parameters.orb >>"
  malformed: circleci/node
  node: circleci/node@7.1.0
workflows:
  test:
    jobs: []
`;
    writeFileSync(configPath, content);
    const provider = new CircleCIProvider();

    assert.deepStrictEqual(provider.readManifest(configPath), {
      filePath: configPath,
      name: "web",
      dependencies: {
        "circleci/node": "7.1.0",
      },
      dependencyVersions: {
        "circleci/node": ["7.1.0"],
      },
    });
  });

  test("should keep orb and image references without matching dependencies", () => {
    const content = `version: 2.1
orbs:
  node: circleci/node@7.1.0
jobs:
  test:
    docker:
      - image: cimg/node:22.11
`;
    writeFileSync(configPath, content);
    const provider = new CircleCIProvider();

    provider.writeManifest(configPath, {
      filePath: configPath,
      dependencies: {},
    });

    assert.strictEqual(readFileSync(configPath, "utf8"), content);
  });
});
