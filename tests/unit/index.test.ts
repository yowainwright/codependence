import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertContainsEqual } from "../helpers/assertions";
import * as entry from "../../src";

const readPackage = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Record<string, unknown>;

type RepositoryPathRule = (typeof entry.schema.definitions.repositoryPath.allOf)[number];

const matchesRepositoryPathRule = (path: string, rule: RepositoryPathRule): boolean => {
  if ("pattern" in rule) return new RegExp(rule.pattern).test(path);
  return !new RegExp(rule.not.pattern).test(path);
};

const schemaAllowsRepositoryPath = (path: string): boolean =>
  entry.schema.definitions.repositoryPath.allOf.every((rule) =>
    matchesRepositoryPathRule(path, rule),
  );

describe("package entry", () => {
  test("exports the public API without running the CLI", () => {
    assert.deepStrictEqual((Object.keys(entry).sort()), [
      "checkFiles",
      "codependence",
      "default",
      "schema",
      "script",
    ]);
    assert.strictEqual((typeof entry.checkFiles), "function");
    assert.strictEqual((typeof entry.codependence), "function");
    assert.strictEqual((entry.schema.$id), "https://unpkg.com/codependence/src/schema.json");
    assert.strictEqual((typeof entry.script), "function");
    assert.strictEqual((entry.default), entry.codependence);
  });

  test("publishes the configuration schema", () => {
    const rootPackage = readPackage("../../package.json");
    const exports = rootPackage.exports as Record<string, unknown>;
    const files = rootPackage.files as string[];

    assert.strictEqual((exports["./schema.json"]), "./src/schema.json");
    assert.ok((files).includes("src/schema.json"));
    assert.strictEqual((entry.schema["x-revision"]), 2);
    assert.strictEqual((entry.schema["x-created"]), "2025-11-23");
    assert.strictEqual((entry.schema["x-updated"]), "2026-08-17");
    assert.ok((entry.schema["x-history"]).includes("/commits/main/src/schema.json"));
    assert.deepStrictEqual((entry.schema.definitions.target.required), ["manager"]);
    assert.deepStrictEqual((entry.schema.definitions.manifest.required), ["path", "manager"]);
    assert.deepStrictEqual((entry.schema.definitions.manifest.properties.ignore), {
      $ref: "#/properties/ignore",
    });
    assert.deepStrictEqual((entry.schema.definitions.manifest.properties.rootDir), {
      $ref: "#/properties/rootDir",
    });
    assert.deepStrictEqual((entry.schema.definitions.manifest.properties.path), {
      $ref: "#/definitions/repositoryPath",
    });
    assert.deepStrictEqual((entry.schema.definitions.lockfile.oneOf[1]), {
      $ref: "#/definitions/repositoryPath",
    });
    assertContainsEqual((entry.schema.anyOf), { required: ["permissive"] });
    assertContainsEqual((entry.schema.anyOf), { required: ["mode"] });
  });

  test("keeps runtime dependencies out of the published package", () => {
    const rootPackage = readPackage("../../package.json");
    const sitePackage = readPackage("../../page/app/package.json");
    const siteDependencies = sitePackage.dependencies as Record<string, string>;

    assert.strictEqual((rootPackage.dependencies), undefined);
    assert.strictEqual((siteDependencies.react), "^19.2.8");
  });

  test("restricts manifest and lockfile paths to the repository", () => {
    assert.strictEqual((schemaAllowsRepositoryPath("packages/web/package.json")), true);
    assert.strictEqual((schemaAllowsRepositoryPath("C:relative\\package.json")), true);
    assert.strictEqual((schemaAllowsRepositoryPath("../package.json")), false);
    assert.strictEqual((schemaAllowsRepositoryPath("packages/../package.json")), false);
    assert.strictEqual((schemaAllowsRepositoryPath("/repo/package.json")), false);
    assert.strictEqual((schemaAllowsRepositoryPath("\\repo\\package.json")), false);
    assert.strictEqual((schemaAllowsRepositoryPath("C:\\repo\\package.json")), false);
  });
});
