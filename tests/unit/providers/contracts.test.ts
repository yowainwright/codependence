import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertRejects } from "../../helpers/assertions";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  DockerProvider,
  GitHubActionsProvider,
  GoProvider,
  NodeJSProvider,
  PythonProvider,
  RustProvider,
} from "../../../src/providers";
import type { DependencyProvider } from "../../../src/providers";
import { isWithinLevel } from "../../../src/utils/semver";

const providers = (): DependencyProvider[] => [
  new NodeJSProvider({ isTesting: true }),
  new GoProvider({ isTesting: true }),
  new PythonProvider("requirements.txt", "pip", { isTesting: true }),
  new RustProvider({ isTesting: true }),
  new DockerProvider(),
  new GitHubActionsProvider(),
];

describe("provider contracts", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-provider-contracts");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("all providers declare resolution capabilities", () => {
    providers().forEach((provider) => {
      assert.strictEqual((typeof provider.capabilities.supportsLatestResolution), "boolean");
      assert.strictEqual((typeof provider.capabilities.supportsPreciseMode), "boolean");
      assert.ok((["semver", "exact"]).includes(provider.capabilities.versionStrategy));
    });
  });

  test("providers without latest resolution fail before registry lookup", async () => {
    const unsupportedProviders = providers().filter(
      (provider) => !provider.capabilities.supportsLatestResolution,
    );

    for (const provider of unsupportedProviders) {
      await assertRejects(provider.getLatestVersion("example"), "requires explicit version pins");
      await assertRejects(provider.getAllVersions("example"), "requires explicit version pins");
    }
  });

  test("exact-version providers ignore semver level gates", () => {
    const exactProviders = providers().filter(
      (provider) => provider.capabilities.versionStrategy === "exact",
    );

    exactProviders.forEach((provider) => {
      const isAllowed = isWithinLevel("v1", "v9", "patch", provider.capabilities.versionStrategy);
      assert.strictEqual((isAllowed), true);
    });
  });

  test("text providers can write their own parsed manifest without changing files", () => {
    const cases = [
      {
        provider: new DockerProvider(),
        file: "Dockerfile",
        content: "FROM node:24-slim\nFROM alpine:${ALPINE_VERSION}\n",
      },
      {
        provider: new GitHubActionsProvider(),
        file: "ci.yml",
        content: "steps:\n  - uses: actions/checkout@v5\n  - uses: ./local\n",
      },
      {
        provider: new RustProvider({ isTesting: true }),
        file: "Cargo.toml",
        content: '[dependencies]\nserde = "1.0.210"\nlocal = { path = "../local" }\n',
      },
    ];

    cases.forEach(({ provider, file, content }) => {
      const filePath = join(tmpDir, file);
      writeFileSync(filePath, content);

      const manifest = provider.readManifest(filePath);
      provider.writeManifest(filePath, manifest);

      assert.strictEqual((readFileSync(filePath, "utf8")), content);
    });
  });
});
