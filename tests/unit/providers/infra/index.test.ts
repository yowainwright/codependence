import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import {
  emptyInfraManifest,
  infraManifestName,
  manifestOnlyResolution,
} from "../../../../src/providers/infra";

describe("infra provider helpers", () => {
  test("should derive manifest names from project and file paths", () => {
    assert.strictEqual(infraManifestName(join("api", "k8s", "deployment.yaml")), "api");
    assert.strictEqual(infraManifestName("deployment.yaml"), "deployment.yaml");
  });

  test("should create empty infrastructure manifests", () => {
    const filePath = join("api", "manifests", "deployment.yaml");

    assert.deepStrictEqual(emptyInfraManifest(filePath), {
      dependencies: {},
      filePath,
      name: "api",
    });
  });

  test("should reject automatic provider resolution", () => {
    assert.throws(() => manifestOnlyResolution("Infra"), /Infra provider requires/);
  });
});
