import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  findSimilarPackages,
  getSuggestionForPackage,
  formatEnhancedError,
} from "../../../src/dx/report";
import { COMMON_PACKAGES } from "../../../src/dx/report/constants";
import type { ErrorContext } from "../../../src/dx/report";

describe("findSimilarPackages", () => {
  test("should find packages with distance 1", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("lodas", candidates, 3);

    assert.ok(result.includes("lodash"));
  });

  test("should find packages with distance 2", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("loda", candidates, 3);

    assert.ok(result.includes("lodash"));
  });

  test("should return empty array when no matches within distance", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("completely-different", candidates, 3);

    assert.deepStrictEqual(result, []);
  });

  test("should be case insensitive", () => {
    const candidates = ["React", "Express"];
    const result = findSimilarPackages("react", candidates, 0);

    assert.ok(result.includes("React"));
  });

  test("should limit results to 3 packages", () => {
    const candidates = ["lodash", "loadash", "lodas", "loda", "lod", "lo", "l"];
    const result = findSimilarPackages("lodash", candidates, 5);

    assert.ok(result.length <= 3);
  });

  test("should sort by distance (closest first)", () => {
    const candidates = ["lodash", "express", "lodas"];
    const result = findSimilarPackages("lodash", candidates, 3);

    assert.strictEqual(result[0], "lodash");
    assert.strictEqual(result[1], "lodas");
  });

  test("should handle exact matches", () => {
    const candidates = ["lodash", "express"];
    const result = findSimilarPackages("lodash", candidates, 3);

    assert.strictEqual(result[0], "lodash");
  });

  test("should handle empty candidates array", () => {
    const result = findSimilarPackages("lodash", [], 3);

    assert.deepStrictEqual(result, []);
  });

  test("should respect custom maxDistance parameter", () => {
    const candidates = ["lodash", "express", "react"];
    const result = findSimilarPackages("lod", candidates, 1);

    assert.deepStrictEqual(result, []);
  });

  test("should find common typos", () => {
    const candidates = COMMON_PACKAGES;
    const result = findSimilarPackages("expres", candidates, 2);

    assert.ok(result.includes("express"));
  });
});

describe("getSuggestionForPackage", () => {
  test("should suggest lodash for loadsh", () => {
    const result = getSuggestionForPackage("loadsh");

    assert.strictEqual(result, "lodash");
  });

  test("should suggest react for reac", () => {
    const result = getSuggestionForPackage("reac");

    assert.strictEqual(result, "react");
  });

  test("should suggest express for expres", () => {
    const result = getSuggestionForPackage("expres");

    assert.strictEqual(result, "express");
  });

  test("should return null for completely different package", () => {
    const result = getSuggestionForPackage("some-unique-package-xyz");

    assert.strictEqual(result, null);
  });

  test("should return null for packages with distance > 2", () => {
    const result = getSuggestionForPackage("xyz");

    assert.strictEqual(result, null);
  });

  test("should suggest typescript for typescri", () => {
    const result = getSuggestionForPackage("typescri");

    assert.strictEqual(result, "typescript");
  });

  test("should suggest jest for jes", () => {
    const result = getSuggestionForPackage("jes");

    assert.strictEqual(result, "jest");
  });

  test("should handle case insensitive matching", () => {
    const result = getSuggestionForPackage("LODASH");

    assert.strictEqual(result, "lodash");
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

    assert.ok(result.includes('Failed to fetch version for "invalid@package"'));
    assert.ok(result.includes("Invalid package name format"));
    assert.ok(result.includes("Check the package name spelling"));
  });

  test("should format network error", () => {
    const context: ErrorContext = {
      packageName: "lodash",
      error: new Error("Network timeout"),
      isNetworkError: true,
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes('Failed to fetch version for "lodash"'));
    assert.ok(result.includes("Network connection issue"));
    assert.ok(result.includes("Check your internet connection"));
  });

  test("should format error with package suggestion", () => {
    const context: ErrorContext = {
      packageName: "loadsh",
      error: new Error("Package not found"),
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes('Failed to fetch version for "loadsh"'));
    assert.ok(result.includes('Did you mean "lodash"?'));
    assert.ok(result.includes("npm view loadsh"));
  });

  test("should format error without package suggestion", () => {
    const context: ErrorContext = {
      packageName: "some-unique-package-xyz",
      error: new Error("Package not found"),
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes('Failed to fetch version for "some-unique-package-xyz"'));
    assert.ok(result.includes("Private package?"));
    assert.ok(result.includes("Package doesn't exist on npm registry"));
    assert.ok(!result.includes("Did you mean"));
  });

  test("should include npm view suggestion", () => {
    const context: ErrorContext = {
      packageName: "test-package",
      error: new Error("Not found"),
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes("npm view test-package"));
  });

  test("should handle string error instead of Error object", () => {
    const context: ErrorContext = {
      packageName: "test-package",
      error: "Simple error string",
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes('Failed to fetch version for "test-package"'));
  });

  test("should suggest react for reac typo", () => {
    const context: ErrorContext = {
      packageName: "reac",
      error: new Error("Not found"),
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes('Did you mean "react"?'));
  });

  test("should suggest express for expres typo", () => {
    const context: ErrorContext = {
      packageName: "expres",
      error: new Error("Not found"),
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes('Did you mean "express"?'));
  });

  test("should prioritize validation error over network error", () => {
    const context: ErrorContext = {
      packageName: "invalid",
      error: new Error("Error"),
      isValidationError: true,
      isNetworkError: true,
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes("Invalid package name format"));
    assert.ok(!result.includes("Network connection issue"));
  });

  test("should prioritize network error over suggestion", () => {
    const context: ErrorContext = {
      packageName: "loadsh",
      error: new Error("Error"),
      isNetworkError: true,
    };

    const result = formatEnhancedError(context);

    assert.ok(result.includes("Network connection issue"));
    assert.ok(!result.includes("Did you mean"));
  });

  describe("private package detection", () => {
    test("should detect private package via unauthorized error", () => {
      const context: ErrorContext = {
        packageName: "@myorg/private-package",
        error: new Error("E401 unauthorized"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("PRIVATE PACKAGE"));
      assert.ok(result.includes(".npmrc with auth token"));
      assert.ok(result.includes("Configure custom registry"));
    });

    test("should detect private package with explicit flag", () => {
      const context: ErrorContext = {
        packageName: "@company/internal-lib",
        error: new Error("Not found"),
        isPrivatePackage: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("PRIVATE PACKAGE"));
      assert.ok(result.includes("//registry.npmjs.org/:_authToken="));
    });

    test("should provide .npmrc suggestion for private packages", () => {
      const context: ErrorContext = {
        packageName: "@myorg/package",
        error: new Error("401 Unauthorized"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Option 1: Add .npmrc with auth token"));
      assert.ok(result.includes("Option 2: Configure custom registry"));
      assert.ok(result.includes("Option 3: Exclude from codependencies"));
    });

    test("should not detect non-scoped packages as private", () => {
      const context: ErrorContext = {
        packageName: "regular-package",
        error: new Error("Not found"),
      };

      const result = formatEnhancedError(context);

      assert.ok(!result.includes("PRIVATE PACKAGE"));
    });

    test("should not detect packages without slash as private", () => {
      const context: ErrorContext = {
        packageName: "@scoped",
        error: new Error("Not found"),
      };

      const result = formatEnhancedError(context);

      assert.ok(!result.includes("PRIVATE PACKAGE"));
    });
  });

  describe("registry mismatch detection", () => {
    test("should detect registry mismatch in error message", () => {
      const context: ErrorContext = {
        packageName: "lodash",
        error: new Error("Package not found in registry"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Package found in npm but not your registry"));
      assert.ok(result.includes("custom registry"));
      assert.ok(result.includes("npm config set registry"));
    });

    test("should detect registry mismatch with explicit flag", () => {
      const context: ErrorContext = {
        packageName: "react",
        error: new Error("Not found"),
        isRegistryMismatch: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Package found in npm but not your registry"));
      assert.ok(
        result
          .split("\n")
          .includes("  - Use public npm: npm config set registry https://registry.npmjs.org"),
      );
    });

    test("should provide registry configuration suggestions", () => {
      const context: ErrorContext = {
        packageName: "express",
        error: new Error("404 from registry"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Add package to your internal registry"));
      assert.ok(result.includes("codependence --registry"));
    });

    test("should detect case insensitive registry keyword", () => {
      const context: ErrorContext = {
        packageName: "test",
        error: new Error("Registry timeout"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("registry"));
    });
  });

  describe("timeout detection", () => {
    test("should detect timeout in error message", () => {
      const context: ErrorContext = {
        packageName: "slow-package",
        error: new Error("Request timeout"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Network timeout"));
      assert.ok(result.includes("Check internet connection"));
      assert.ok(result.includes("--timeout 30000"));
    });

    test("should detect ETIMEDOUT error code", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("ETIMEDOUT connection timeout"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Network timeout"));
      assert.ok(result.includes("Retrying automatically"));
    });

    test("should detect 'timed out' phrase", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("Connection timed out"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Network timeout"));
    });

    test("should show retry count when provided", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("timeout"),
        retryCount: 2,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Attempt 2/3"));
    });

    test("should not show retry message when retryCount is 0", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("timeout"),
        retryCount: 0,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Retrying automatically"));
    });

    test("should provide timeout configuration suggestion", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("timeout"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Increase timeout: --timeout 30000"));
      assert.ok(result.includes("npm cache clean"));
    });

    test("should detect timeout with explicit flag", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("Network error"),
        isTimeout: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Network timeout"));
    });

    test("should not show timeout for network error", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("Network timeout"),
        isNetworkError: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Network connection issue"));
      assert.ok(!result.includes("Retrying automatically"));
    });

    test("should provide proxy configuration suggestion", () => {
      const context: ErrorContext = {
        packageName: "test-package",
        error: new Error("timeout"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("If behind proxy, configure npm config"));
    });
  });

  describe("error prioritization", () => {
    test("should prioritize validation over private package", () => {
      const context: ErrorContext = {
        packageName: "@org/invalid",
        error: new Error("Error"),
        isValidationError: true,
        isPrivatePackage: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Invalid package name format"));
      assert.ok(!result.includes("PRIVATE PACKAGE"));
    });

    test("should prioritize private package over registry mismatch", () => {
      const context: ErrorContext = {
        packageName: "@org/package",
        error: new Error("registry error"),
        isPrivatePackage: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("PRIVATE PACKAGE"));
      assert.ok(!result.includes("registry mismatch"));
    });

    test("should prioritize registry mismatch over timeout", () => {
      const context: ErrorContext = {
        packageName: "package",
        error: new Error("registry timeout"),
        isRegistryMismatch: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Package found in npm but not your registry"));
      assert.ok(!result.includes("Retrying automatically"));
    });

    test("should prioritize timeout over network error", () => {
      const context: ErrorContext = {
        packageName: "package",
        error: new Error("timeout"),
      };

      const result = formatEnhancedError(context);

      assert.ok(result.includes("Network timeout"));
    });

    test("should not show error message for private packages with explicit flag", () => {
      const context: ErrorContext = {
        packageName: "@org/package",
        error: new Error("Some detailed error message"),
        isPrivatePackage: true,
      };

      const result = formatEnhancedError(context);

      assert.ok(!result.includes("Some detailed error message"));
    });

    test("should not show error message for registry mismatch", () => {
      const context: ErrorContext = {
        packageName: "package",
        error: new Error("registry error with details"),
      };

      const result = formatEnhancedError(context);

      assert.ok(!result.includes("registry error with details"));
    });
  });
});

describe("COMMON_PACKAGES", () => {
  test("should include popular packages", () => {
    assert.ok(COMMON_PACKAGES.includes("lodash"));
    assert.ok(COMMON_PACKAGES.includes("react"));
    assert.ok(COMMON_PACKAGES.includes("express"));
    assert.ok(COMMON_PACKAGES.includes("typescript"));
    assert.ok(COMMON_PACKAGES.includes("jest"));
  });

  test("should be an array", () => {
    assert.strictEqual(Array.isArray(COMMON_PACKAGES), true);
  });

  test("should have at least 10 packages", () => {
    assert.ok(COMMON_PACKAGES.length >= 10);
  });
});
