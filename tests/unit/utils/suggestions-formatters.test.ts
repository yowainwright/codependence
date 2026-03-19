import { describe, test, expect } from "bun:test";
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
  test("returns true for scoped package with slash", () => {
    expect(isPrivatePackage("@myorg/package")).toBe(true);
  });

  test("returns false for scoped package without slash", () => {
    expect(isPrivatePackage("@scoped")).toBe(false);
  });

  test("returns false for regular package", () => {
    expect(isPrivatePackage("lodash")).toBe(false);
  });

  test("returns false for package with slash but no @", () => {
    expect(isPrivatePackage("some/path")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isPrivatePackage("")).toBe(false);
  });
});

describe("hasRegistryInError", () => {
  test("detects registry keyword in Error", () => {
    expect(hasRegistryInError(new Error("Package not found in registry"))).toBe(true);
  });

  test("detects registry keyword in string", () => {
    expect(hasRegistryInError("Custom registry error")).toBe(true);
  });

  test("is case insensitive", () => {
    expect(hasRegistryInError(new Error("REGISTRY timeout"))).toBe(true);
  });

  test("returns false when no registry mention", () => {
    expect(hasRegistryInError(new Error("Network timeout"))).toBe(false);
  });

  test("returns false for empty error", () => {
    expect(hasRegistryInError("")).toBe(false);
  });
});

describe("isTimeout", () => {
  test("detects timeout keyword", () => {
    expect(isTimeout(new Error("Request timeout"))).toBe(true);
  });

  test("detects timed out phrase", () => {
    expect(isTimeout("Connection timed out")).toBe(true);
  });

  test("detects ETIMEDOUT code", () => {
    expect(isTimeout(new Error("ETIMEDOUT"))).toBe(true);
  });

  test("is case insensitive", () => {
    expect(isTimeout(new Error("TIMEOUT"))).toBe(true);
  });

  test("returns false for non-timeout error", () => {
    expect(isTimeout(new Error("404 Not Found"))).toBe(false);
  });
});

describe("formatValidationError", () => {
  test("includes package name", () => {
    const result = formatValidationError("bad-pkg");
    expect(result).toContain('Failed to fetch version for "bad-pkg"');
  });

  test("includes validation-specific guidance", () => {
    const result = formatValidationError("bad-pkg");
    expect(result).toContain("Invalid package name format");
    expect(result).toContain("Package name contains invalid characters");
    expect(result).toContain("Check the package name spelling");
  });

  test("uses special characters instead of emojis", () => {
    const result = formatValidationError("bad-pkg");
    expect(result).toContain("[x]");
    expect(result).toContain(">");
    expect(result).not.toMatch(/[\u{1F600}-\u{1F64F}]/u);
  });
});

describe("formatPrivatePackageError", () => {
  test("includes package name", () => {
    const result = formatPrivatePackageError("@org/pkg");
    expect(result).toContain('Failed to fetch version for "@org/pkg"');
  });

  test("identifies as private package", () => {
    const result = formatPrivatePackageError("@org/pkg");
    expect(result).toContain("PRIVATE PACKAGE");
  });

  test("provides all three fix options", () => {
    const result = formatPrivatePackageError("@org/pkg");
    expect(result).toContain("Option 1: Add .npmrc with auth token");
    expect(result).toContain("Option 2: Configure custom registry");
    expect(result).toContain("Option 3: Exclude from codependencies");
  });

  test("includes npmrc auth token example", () => {
    const result = formatPrivatePackageError("@org/pkg");
    expect(result).toContain("//registry.npmjs.org/:_authToken=");
  });

  test("includes package-specific removal suggestion", () => {
    const result = formatPrivatePackageError("@org/my-lib");
    expect(result).toContain('Remove "@org/my-lib" from your config');
  });
});

describe("formatRegistryError", () => {
  test("includes package name", () => {
    const result = formatRegistryError("lodash");
    expect(result).toContain('Failed to fetch version for "lodash"');
  });

  test("mentions registry mismatch", () => {
    const result = formatRegistryError("lodash");
    expect(result).toContain("Package found in npm but not your registry");
    expect(result).toContain("custom registry");
  });

  test("provides fix suggestions", () => {
    const result = formatRegistryError("lodash");
    expect(result).toContain("Add package to your internal registry");
    expect(result).toContain("npm config set registry https://registry.npmjs.org");
    expect(result).toContain("codependence --registry");
  });
});

describe("formatTimeoutError", () => {
  test("includes package name", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    expect(result).toContain('Failed to fetch version for "slow-pkg"');
  });

  test("shows network timeout message", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    expect(result).toContain("Network timeout");
  });

  test("shows retry message on first attempt", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    expect(result).toContain("Retrying automatically...");
  });

  test("shows attempt count on retries", () => {
    const result = formatTimeoutError("slow-pkg", 2);
    expect(result).toContain("Attempt 2/3");
    expect(result).not.toContain("Retrying automatically");
  });

  test("provides troubleshooting suggestions", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    expect(result).toContain("Check internet connection");
    expect(result).toContain("If behind proxy");
    expect(result).toContain("--timeout 30000");
    expect(result).toContain("npm cache clean");
  });

  test("uses special characters instead of emojis", () => {
    const result = formatTimeoutError("slow-pkg", 0);
    expect(result).toContain("[!]");
    expect(result).not.toMatch(/[\u{1F600}-\u{1F64F}]/u);
  });
});

describe("formatNetworkError", () => {
  test("includes package name", () => {
    const result = formatNetworkError("lodash");
    expect(result).toContain('Failed to fetch version for "lodash"');
  });

  test("lists network-related issues", () => {
    const result = formatNetworkError("lodash");
    expect(result).toContain("Network connection issue");
    expect(result).toContain("npm registry is unreachable");
    expect(result).toContain("Firewall or proxy blocking request");
  });

  test("provides suggestion", () => {
    const result = formatNetworkError("lodash");
    expect(result).toContain("Check your internet connection and try again");
  });
});

describe("formatGenericError", () => {
  test("includes package name", () => {
    const result = formatGenericError("some-pkg", "Not found");
    expect(result).toContain('Failed to fetch version for "some-pkg"');
  });

  test("includes suggestion for known typo", () => {
    const result = formatGenericError("loadsh", "Not found");
    expect(result).toContain('Did you mean "lodash"?');
  });

  test("shows generic issues for unknown package", () => {
    const result = formatGenericError("zzz-unknown-pkg-zzz", "Not found");
    expect(result).toContain("Private package? (configure .npmrc)");
    expect(result).toContain("Package doesn't exist on npm registry");
    expect(result).toContain("Network issue? Check your connection");
  });

  test("includes npm view suggestion", () => {
    const result = formatGenericError("test-pkg", "Not found");
    expect(result).toContain("npm view test-pkg");
  });

  test("appends error string for non-special cases", () => {
    const result = formatGenericError("test-pkg", "Some error detail");
    expect(result).toContain("Error: Some error detail");
  });

  test("omits error string for private packages", () => {
    const result = formatGenericError("@org/pkg", "Some error");
    expect(result).not.toContain("Error: Some error");
  });
});
