import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivatePackage,
  hasRegistryInError,
  isTimeout,
  formatValidationError,
  formatPrivatePackageError,
  formatRegistryError,
  formatTimeoutError,
  formatNetworkError,
  formatGenericError,
} from "../../../src/utils/suggestions";

describe("isPrivatePackage", () => {
  test("returns true for 401 unauthorized error", () => {
    assert.strictEqual((isPrivatePackage(new Error("E401 unauthorized"))), true);
  });

  test("returns true for unauthorized error string", () => {
    assert.strictEqual((isPrivatePackage("unauthorized access")), true);
  });

  test("returns true for private package error message", () => {
    assert.strictEqual((isPrivatePackage(new Error("private package not accessible"))), true);
  });

  test("returns false for network error", () => {
    assert.strictEqual((isPrivatePackage(new Error("ENOTFOUND registry.npmjs.org"))), false);
  });

  test("returns false for empty error", () => {
    assert.strictEqual((isPrivatePackage("")), false);
  });
});

describe("hasRegistryInError", () => {
  test("detects registry keyword in Error", () => {
    assert.strictEqual((hasRegistryInError(new Error("Package not found in registry"))), true);
  });

  test("detects registry keyword in string", () => {
    assert.strictEqual((hasRegistryInError("Custom registry error")), true);
  });

  test("is case insensitive", () => {
    assert.strictEqual((hasRegistryInError(new Error("REGISTRY timeout"))), true);
  });

  test("returns false when no registry mention", () => {
    assert.strictEqual((hasRegistryInError(new Error("Network timeout"))), false);
  });

  test("returns false for empty error", () => {
    assert.strictEqual((hasRegistryInError("")), false);
  });
});

describe("isTimeout", () => {
  test("detects timeout keyword", () => {
    assert.strictEqual((isTimeout(new Error("Request timeout"))), true);
  });

  test("detects timed out phrase", () => {
    assert.strictEqual((isTimeout("Connection timed out")), true);
  });

  test("detects ETIMEDOUT code", () => {
    assert.strictEqual((isTimeout(new Error("ETIMEDOUT"))), true);
  });

  test("is case insensitive", () => {
    assert.strictEqual((isTimeout(new Error("TIMEOUT"))), true);
  });

  test("returns false for non-timeout error", () => {
    assert.strictEqual((isTimeout(new Error("404 Not Found"))), false);
  });
});

describe("formatValidationError", () => {
  test("includes package name", () => {
    const result = formatValidationError("bad-pkg");
    assert.ok((result).includes('Failed to fetch version for "bad-pkg"'));
  });

  test("includes validation-specific guidance", () => {
    const result = formatValidationError("bad-pkg");
    assert.ok((result).includes("Invalid package name format"));
    assert.ok((result).includes("Package name contains invalid characters"));
    assert.ok((result).includes("Check the package name spelling"));
  });

  test("uses special characters instead of emojis", () => {
    const result = formatValidationError("bad-pkg");
    assert.ok((result).includes("[x]"));
    assert.ok((result).includes(">"));
    assert.doesNotMatch((result), /[\u{1F600}-\u{1F64F}]/u);
  });
});

describe("formatPrivatePackageError", () => {
  test("includes package name", () => {
    const result = formatPrivatePackageError("@org/pkg");
    assert.ok((result).includes('Failed to fetch version for "@org/pkg"'));
  });

  test("identifies as private package", () => {
    const result = formatPrivatePackageError("@org/pkg");
    assert.ok((result).includes("PRIVATE PACKAGE"));
  });

  test("provides all three fix options", () => {
    const result = formatPrivatePackageError("@org/pkg");
    assert.ok((result).includes("Option 1: Add .npmrc with auth token"));
    assert.ok((result).includes("Option 2: Configure custom registry"));
    assert.ok((result).includes("Option 3: Exclude from codependencies"));
  });

  test("includes npmrc auth token example", () => {
    const result = formatPrivatePackageError("@org/pkg");
    assert.ok((result).includes("//registry.npmjs.org/:_authToken="));
  });

  test("includes package-specific removal suggestion", () => {
    const result = formatPrivatePackageError("@org/my-lib");
    assert.ok((result).includes('Remove "@org/my-lib" from your config'));
  });
});

describe("formatRegistryError", () => {
  test("includes package name", () => {
    const result = formatRegistryError("lodash");
    assert.ok((result).includes('Failed to fetch version for "lodash"'));
  });

  test("mentions registry mismatch", () => {
    const result = formatRegistryError("lodash");
    assert.ok((result).includes("Package found in npm but not your registry"));
    assert.ok((result).includes("custom registry"));
  });

  test("provides fix suggestions", () => {
    const result = formatRegistryError("lodash");
    assert.ok((result).includes("Add package to your internal registry"));
    assert.ok((result).includes("npm config set registry https://registry.npmjs.org"));
    assert.ok((result).includes("codependence --registry"));
  });
});

describe("formatTimeoutError", () => {
  test("includes package name", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    assert.ok((result).includes('Failed to fetch version for "slow-pkg"'));
  });

  test("shows network timeout message", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    assert.ok((result).includes("Network timeout"));
  });

  test("shows retry message on first attempt", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    assert.ok((result).includes("Retrying automatically..."));
  });

  test("shows attempt count on retries", () => {
    const result = formatTimeoutError("slow-pkg", 2);
    assert.ok((result).includes("Attempt 2/3"));
    assert.ok(!(result).includes("Retrying automatically"));
  });

  test("provides troubleshooting suggestions", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    assert.ok((result).includes("Check internet connection"));
    assert.ok((result).includes("If behind proxy"));
    assert.ok((result).includes("--timeout 30000"));
    assert.ok((result).includes("npm cache clean"));
  });

  test("uses special characters instead of emojis", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    assert.ok((result).includes("[!]"));
    assert.doesNotMatch((result), /[\u{1F600}-\u{1F64F}]/u);
  });
});

describe("formatNetworkError", () => {
  test("includes package name", () => {
    const result = formatNetworkError("lodash");
    assert.ok((result).includes('Failed to fetch version for "lodash"'));
  });

  test("lists network-related issues", () => {
    const result = formatNetworkError("lodash");
    assert.ok((result).includes("Network connection issue"));
    assert.ok((result).includes("npm registry is unreachable"));
    assert.ok((result).includes("Firewall or proxy blocking request"));
  });

  test("provides suggestion", () => {
    const result = formatNetworkError("lodash");
    assert.ok((result).includes("Check your internet connection and try again"));
  });
});

describe("formatGenericError", () => {
  test("includes package name", () => {
    const result = formatGenericError("some-pkg", "Not found");
    assert.ok((result).includes('Failed to fetch version for "some-pkg"'));
  });

  test("includes suggestion for known typo", () => {
    const result = formatGenericError("loadsh", "Not found");
    assert.ok((result).includes('Did you mean "lodash"?'));
  });

  test("shows generic issues for unknown package", () => {
    const result = formatGenericError("zzz-unknown-pkg-zzz", "Not found");
    assert.ok((result).includes("Private package? (configure .npmrc)"));
    assert.ok((result).includes("Package doesn't exist on npm registry"));
    assert.ok((result).includes("Network issue? Check your connection"));
  });

  test("includes npm view suggestion", () => {
    const result = formatGenericError("test-pkg", "Not found");
    assert.ok((result).includes("npm view test-pkg"));
  });

  test("appends error string for non-special cases", () => {
    const result = formatGenericError("test-pkg", "Some error detail");
    assert.ok((result).includes("Error: Some error detail"));
  });

  test("omits error string when error contains registry mention", () => {
    const result = formatGenericError("some-pkg", "Package not found in registry");
    assert.ok(!(result).includes("Error: Package not found in registry"));
  });
});
