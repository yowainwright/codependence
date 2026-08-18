import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertMatchObject } from "../../helpers/assertions";
import { validatePackageName } from "../../../src/utils/validate-package";

describe("validatePackageName", () => {
  test("rejects missing and non-string package names", () => {
    assertMatchObject((validatePackageName(null)), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot be null"],
    });
    assertMatchObject((validatePackageName(undefined)), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot be undefined"],
    });
    assertMatchObject((validatePackageName(42)), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name must be a string"],
    });
  });

  test("rejects package names with leading or trailing spaces", () => {
    const result = validatePackageName(" lodash");

    assert.strictEqual((result.validForNewPackages), false);
    assert.strictEqual((result.validForOldPackages), false);
    assert.ok((result.errors).includes("name cannot contain leading or trailing spaces"));
  });

  test("rejects empty names and reserved leading characters", () => {
    assertMatchObject((validatePackageName("")), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name length must be greater than zero"],
    });
    assertMatchObject((validatePackageName(".package")), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with a period"],
    });
    assertMatchObject((validatePackageName("_package")), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with an underscore"],
    });
  });

  test("rejects names reserved by npm package paths", () => {
    assertMatchObject((validatePackageName("node_modules")), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["node_modules is not a valid package name"],
    });
  });

  test("warns for legacy-valid names that npm no longer accepts for new packages", () => {
    const result = validatePackageName(`${"A".repeat(215)}!`);

    assert.strictEqual((result.validForNewPackages), false);
    assert.strictEqual((result.validForOldPackages), true);
    assert.deepStrictEqual((result.warnings), [
      "name can no longer contain more than 214 characters",
      "name can no longer contain capital letters",
      'name can no longer contain special characters ("~\'!()*")',
    ]);
  });

  test("rejects scoped package segments that start with a period", () => {
    assertMatchObject((validatePackageName("@scope/.package")), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with a period"],
    });
  });
});
