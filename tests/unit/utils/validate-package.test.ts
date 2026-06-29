import { describe, expect, test } from "bun:test";
import { validatePackageName } from "../../../src/utils/validate-package";

describe("validatePackageName", () => {
  test("rejects missing and non-string package names", () => {
    expect(validatePackageName(null)).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot be null"],
    });
    expect(validatePackageName(undefined)).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot be undefined"],
    });
    expect(validatePackageName(42)).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name must be a string"],
    });
  });

  test("rejects package names with leading or trailing spaces", () => {
    const result = validatePackageName(" lodash");

    expect(result.validForNewPackages).toBe(false);
    expect(result.validForOldPackages).toBe(false);
    expect(result.errors).toContain("name cannot contain leading or trailing spaces");
  });

  test("rejects empty names and reserved leading characters", () => {
    expect(validatePackageName("")).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name length must be greater than zero"],
    });
    expect(validatePackageName(".package")).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with a period"],
    });
    expect(validatePackageName("_package")).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with an underscore"],
    });
  });

  test("rejects names reserved by npm package paths", () => {
    expect(validatePackageName("node_modules")).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["node_modules is not a valid package name"],
    });
  });

  test("warns for legacy-valid names that npm no longer accepts for new packages", () => {
    const result = validatePackageName(`${"A".repeat(215)}!`);

    expect(result.validForNewPackages).toBe(false);
    expect(result.validForOldPackages).toBe(true);
    expect(result.warnings).toEqual([
      "name can no longer contain more than 214 characters",
      "name can no longer contain capital letters",
      'name can no longer contain special characters ("~\'!()*")',
    ]);
  });

  test("rejects scoped package segments that start with a period", () => {
    expect(validatePackageName("@scope/.package")).toMatchObject({
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with a period"],
    });
  });
});
