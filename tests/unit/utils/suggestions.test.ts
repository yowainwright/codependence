import { describe, test, expect } from "bun:test";
import {
  findSimilarPackages,
  getSuggestionForPackage,
  formatEnhancedError,
  COMMON_PACKAGES,
  type ErrorContext,
} from "../../../src/utils/suggestions";

describe("findSimilarPackages", () => {
  test("should find packages with distance 1", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("lodas", candidates, 3);

    expect(result).toContain("lodash");
  });

  test("should find packages with distance 2", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("loda", candidates, 3);

    expect(result).toContain("lodash");
  });

  test("should return empty array when no matches within distance", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("completely-different", candidates, 3);

    expect(result).toEqual([]);
  });

  test("should be case insensitive", () => {
    const candidates = ["React", "Express"];
    const result = findSimilarPackages("react", candidates, 0);

    expect(result).toContain("React");
  });

  test("should limit results to 3 packages", () => {
    const candidates = ["lodash", "loadash", "lodas", "loda", "lod", "lo", "l"];
    const result = findSimilarPackages("lodash", candidates, 5);

    expect(result.length).toBeLessThanOrEqual(3);
  });

  test("should sort by distance (closest first)", () => {
    const candidates = ["lodash", "express", "lodas"];
    const result = findSimilarPackages("lodash", candidates, 3);

    expect(result[0]).toBe("lodash");
    expect(result[1]).toBe("lodas");
  });

  test("should handle exact matches", () => {
    const candidates = ["lodash", "express"];
    const result = findSimilarPackages("lodash", candidates, 3);

    expect(result[0]).toBe("lodash");
  });

  test("should handle empty candidates array", () => {
    const result = findSimilarPackages("lodash", [], 3);

    expect(result).toEqual([]);
  });

  test("should respect custom maxDistance parameter", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("lod", candidates, 1);

    expect(result).toEqual([]);
  });

  test("should find common typos", () => {
    const candidates = COMMON_PACKAGES;
    const result = findSimilarPackages("expres", candidates, 2);

    expect(result).toContain("express");
  });
});

describe("getSuggestionForPackage", () => {
  test("should suggest lodash for loadsh", () => {
    const result = getSuggestionForPackage("loadsh");

    expect(result).toBe("lodash");
  });

  test("should suggest react for reac", () => {
    const result = getSuggestionForPackage("reac");

    expect(result).toBe("react");
  });

  test("should suggest express for expres", () => {
    const result = getSuggestionForPackage("expres");

    expect(result).toBe("express");
  });

  test("should return null for completely different package", () => {
    const result = getSuggestionForPackage("some-unique-package-xyz");

    expect(result).toBeNull();
  });

  test("should return null for packages with distance > 2", () => {
    const result = getSuggestionForPackage("xyz");

    expect(result).toBeNull();
  });

  test("should suggest typescript for typescri", () => {
    const result = getSuggestionForPackage("typescri");

    expect(result).toBe("typescript");
  });

  test("should suggest jest for jes", () => {
    const result = getSuggestionForPackage("jes");

    expect(result).toBe("jest");
  });

  test("should handle case insensitive matching", () => {
    const result = getSuggestionForPackage("LODASH");

    expect(result).toBe("lodash");
  });
});

describe("formatEnhancedError", () => {
  test("should format validation error", () => {
    const context: ErrorContext = {
      packageName: "invalid@package",
      error: new Error("Validation failed"),
      isValidationError: true,
    };

    const result = formatEnhancedError(context);

    expect(result).toContain('Failed to fetch version for "invalid@package"');
    expect(result).toContain("Invalid package name format");
    expect(result).toContain("Check the package name spelling");
  });

  test("should format network error", () => {
    const context: ErrorContext = {
      packageName: "lodash",
      error: new Error("Network timeout"),
      isNetworkError: true,
    };

    const result = formatEnhancedError(context);

    expect(result).toContain('Failed to fetch version for "lodash"');
    expect(result).toContain("Network connection issue");
    expect(result).toContain("Check your internet connection");
  });

  test("should format error with package suggestion", () => {
    const context: ErrorContext = {
      packageName: "loadsh",
      error: new Error("Package not found"),
    };

    const result = formatEnhancedError(context);

    expect(result).toContain('Failed to fetch version for "loadsh"');
    expect(result).toContain('Did you mean "lodash"?');
    expect(result).toContain("npm view loadsh");
  });

  test("should format error without package suggestion", () => {
    const context: ErrorContext = {
      packageName: "some-unique-package-xyz",
      error: new Error("Package not found"),
    };

    const result = formatEnhancedError(context);

    expect(result).toContain(
      'Failed to fetch version for "some-unique-package-xyz"',
    );
    expect(result).toContain("Private package?");
    expect(result).toContain("Package doesn't exist on npm registry");
    expect(result).not.toContain("Did you mean");
  });

  test("should include npm view suggestion", () => {
    const context: ErrorContext = {
      packageName: "test-package",
      error: new Error("Not found"),
    };

    const result = formatEnhancedError(context);

    expect(result).toContain("npm view test-package");
  });

  test("should handle string error instead of Error object", () => {
    const context: ErrorContext = {
      packageName: "test-package",
      error: "Simple error string",
    };

    const result = formatEnhancedError(context);

    expect(result).toContain('Failed to fetch version for "test-package"');
  });

  test("should suggest react for reac typo", () => {
    const context: ErrorContext = {
      packageName: "reac",
      error: new Error("Not found"),
    };

    const result = formatEnhancedError(context);

    expect(result).toContain('Did you mean "react"?');
  });

  test("should suggest express for expres typo", () => {
    const context: ErrorContext = {
      packageName: "expres",
      error: new Error("Not found"),
    };

    const result = formatEnhancedError(context);

    expect(result).toContain('Did you mean "express"?');
  });

  test("should prioritize validation error over network error", () => {
    const context: ErrorContext = {
      packageName: "invalid",
      error: new Error("Error"),
      isValidationError: true,
      isNetworkError: true,
    };

    const result = formatEnhancedError(context);

    expect(result).toContain("Invalid package name format");
    expect(result).not.toContain("Network connection issue");
  });

  test("should prioritize network error over suggestion", () => {
    const context: ErrorContext = {
      packageName: "loadsh",
      error: new Error("Error"),
      isNetworkError: true,
    };

    const result = formatEnhancedError(context);

    expect(result).toContain("Network connection issue");
    expect(result).not.toContain("Did you mean");
  });
});

describe("COMMON_PACKAGES", () => {
  test("should include popular packages", () => {
    expect(COMMON_PACKAGES).toContain("lodash");
    expect(COMMON_PACKAGES).toContain("react");
    expect(COMMON_PACKAGES).toContain("express");
    expect(COMMON_PACKAGES).toContain("typescript");
    expect(COMMON_PACKAGES).toContain("jest");
  });

  test("should be an array", () => {
    expect(Array.isArray(COMMON_PACKAGES)).toBe(true);
  });

  test("should have at least 10 packages", () => {
    expect(COMMON_PACKAGES.length).toBeGreaterThanOrEqual(10);
  });
});
