import { describe, it, expect } from "bun:test";
import { validateConfig, formatValidationErrors } from "../../../src/config/validator";
import type { ValidationError } from "../../../src/config/types";

describe("validateConfig", () => {
  describe("valid configurations", () => {
    it("should validate minimal config with codependencies array", () => {
      const config = {
        codependencies: ["react", "lodash"],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate config with codependencies objects", () => {
      const config = {
        codependencies: [
          { react: "^18.0.0" },
          { lodash: "4.17.21" },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate config with mixed codependencies format", () => {
      const config = {
        codependencies: [
          "react",
          { lodash: "4.17.21" },
          "typescript",
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate config with permissive only", () => {
      const config = {
        permissive: true,
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate config with all optional fields", () => {
      const config = {
        codependencies: ["react"],
        permissive: false,
        language: "nodejs",
        files: ["**/package.json"],
        ignore: ["**/node_modules/**"],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate config with python language", () => {
      const config = {
        codependencies: ["django"],
        language: "python",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate config with go language", () => {
      const config = {
        codependencies: ["github.com/gin-gonic/gin"],
        language: "go",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe("root object validation", () => {
    it("should reject non-object config", () => {
      const result = validateConfig("invalid");

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("root");
      expect(result.errors[0].message).toBe("Configuration must be a JSON object");
      expect(result.errors[0].suggestion).toBe('Wrap your config in {}: {"codependencies": [...]}');
    });

    it("should reject null config", () => {
      const result = validateConfig(null);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("root");
    });

    it("should reject array config", () => {
      const result = validateConfig(["react"]);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("root");
    });

    it("should reject number config", () => {
      const result = validateConfig(123);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("root");
    });
  });

  describe("required fields validation", () => {
    it("should reject config without codependencies or permissive", () => {
      const config = {
        language: "nodejs",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      const requiredError = result.errors.find((e) => e.message.includes("either"));
      expect(requiredError).toBeDefined();
      expect(requiredError?.field).toBe("root");
      expect(requiredError?.suggestion).toBe('Add {"codependencies": ["package-name"]} or {"permissive": true}');
    });

    it("should reject empty object config", () => {
      const config = {};

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("root");
    });
  });

  describe("codependencies validation", () => {
    it("should reject non-array codependencies", () => {
      const config = {
        codependencies: "react",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("codependencies");
      expect(result.errors[0].message).toBe('"codependencies" must be an array, got string');
      expect(result.errors[0].suggestion).toBe('Change to array format: {"codependencies": ["package1", "package2"]}');
    });

    it("should reject object codependencies", () => {
      const config = {
        codependencies: { react: "^18.0.0" },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("codependencies");
      expect(result.errors[0].message).toBe('"codependencies" must be an array, got object');
    });

    it("should reject empty string package names", () => {
      const config = {
        codependencies: ["react", "", "lodash"],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("codependencies[1]");
      expect(result.errors[0].message).toBe("Package name cannot be empty string");
      expect(result.errors[0].suggestion).toBe("Remove empty strings from the codependencies array");
    });

    it("should reject empty objects in codependencies", () => {
      const config = {
        codependencies: [{}, "react"],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("codependencies[0]");
      expect(result.errors[0].message).toBe("Object in codependencies must have exactly one key, found 0");
      expect(result.errors[0].suggestion).toBe("Remove empty objects from codependencies array");
    });

    it("should reject objects with multiple keys", () => {
      const config = {
        codependencies: [
          { react: "^18.0.0", lodash: "4.17.21" },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("codependencies[0]");
      expect(result.errors[0].message).toBe("Object in codependencies must have exactly one key, found 2");
      expect(result.errors[0].suggestion).toContain('Split into multiple objects');
    });

    it("should reject non-string version values", () => {
      const config = {
        codependencies: [
          { react: 18 },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("codependencies[0]");
      expect(result.errors[0].message).toBe("Version value must be a string");
      expect(result.errors[0].suggestion).toContain('Change {"react": 18}');
    });

    it("should reject number items in codependencies", () => {
      const config = {
        codependencies: ["react", 123],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("codependencies[1]");
      expect(result.errors[0].message).toBe("Invalid item type: number");
    });

    it("should reject boolean items in codependencies", () => {
      const config = {
        codependencies: ["react", true],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("codependencies[1]");
      expect(result.errors[0].message).toBe("Invalid item type: boolean");
    });
  });

  describe("permissive validation", () => {
    it("should reject non-boolean permissive", () => {
      const config = {
        permissive: "true",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("permissive");
      expect(result.errors[0].message).toBe('"permissive" must be a boolean, got string');
      expect(result.errors[0].suggestion).toBe('Change to: {"permissive": true} or {"permissive": false}');
    });

    it("should reject number permissive", () => {
      const config = {
        permissive: 1,
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("permissive");
      expect(result.errors[0].message).toBe('"permissive" must be a boolean, got number');
    });
  });

  describe("language validation", () => {
    it("should reject non-string language", () => {
      const config = {
        codependencies: ["react"],
        language: 123,
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("language");
      expect(result.errors[0].message).toBe('"language" must be a string, got number');
      expect(result.errors[0].suggestion).toBe("Use one of: nodejs, python, go");
    });

    it("should reject invalid language value", () => {
      const config = {
        codependencies: ["react"],
        language: "ruby",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("language");
      expect(result.errors[0].message).toBe('Invalid language "ruby"');
      expect(result.errors[0].suggestion).toBe("Must be one of: nodejs, python, go");
    });

    it("should reject boolean language", () => {
      const config = {
        codependencies: ["react"],
        language: true,
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("language");
      expect(result.errors[0].message).toBe('"language" must be a string, got boolean');
    });
  });

  describe("files validation", () => {
    it("should reject non-array files", () => {
      const config = {
        codependencies: ["react"],
        files: "**/package.json",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("files");
      expect(result.errors[0].message).toBe('"files" must be an array, got string');
      expect(result.errors[0].suggestion).toBe('Use array format: {"files": ["**/package.json"]}');
    });

    it("should reject non-string values in files array", () => {
      const config = {
        codependencies: ["react"],
        files: ["**/package.json", 123, true],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("files");
      expect(result.errors[0].message).toBe("All file patterns must be strings");
      expect(result.errors[0].suggestion).toBe("Remove non-string values from files array");
    });

    it("should reject object files", () => {
      const config = {
        codependencies: ["react"],
        files: { pattern: "**/*.json" },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("files");
      expect(result.errors[0].message).toBe('"files" must be an array, got object');
    });
  });

  describe("ignore validation", () => {
    it("should reject non-array ignore", () => {
      const config = {
        codependencies: ["react"],
        ignore: "**/node_modules/**",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("ignore");
      expect(result.errors[0].message).toBe('"ignore" must be an array, got string');
      expect(result.errors[0].suggestion).toBe('Use array format: {"ignore": ["**/node_modules/**"]}');
    });

    it("should reject non-string values in ignore array", () => {
      const config = {
        codependencies: ["react"],
        ignore: ["**/node_modules/**", 123],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("ignore");
      expect(result.errors[0].message).toBe("All ignore patterns must be strings");
      expect(result.errors[0].suggestion).toBe("Remove non-string values from ignore array");
    });

    it("should reject object ignore", () => {
      const config = {
        codependencies: ["react"],
        ignore: { pattern: "node_modules" },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("ignore");
      expect(result.errors[0].message).toBe('"ignore" must be an array, got object');
    });
  });

  describe("unknown fields validation", () => {
    it("should reject unknown fields", () => {
      const config = {
        codependencies: ["react"],
        unknown: "field",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("root");
      expect(result.errors[0].message).toBe("Unknown field(s): unknown");
      expect(result.errors[0].suggestion).toBe("Remove unknown fields. Valid fields are: codependencies, permissive, language, files, ignore");
    });

    it("should reject multiple unknown fields", () => {
      const config = {
        codependencies: ["react"],
        unknown1: "field",
        unknown2: "field",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("unknown1");
      expect(result.errors[0].message).toContain("unknown2");
    });

    it("should not allow random properties", () => {
      const config = {
        codependencies: ["react"],
        randomProperty: 123,
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("randomProperty");
    });
  });

  describe("multiple errors", () => {
    it("should collect all validation errors", () => {
      const config = {
        codependencies: "not-an-array",
        permissive: "not-a-boolean",
        language: 123,
        files: "not-an-array",
        ignore: "not-an-array",
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it("should handle multiple codependencies errors", () => {
      const config = {
        codependencies: ["", 123, { react: 18 }],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined config", () => {
      const result = validateConfig(undefined);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("root");
    });

    it("should handle empty array codependencies", () => {
      const config = {
        codependencies: [],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should handle permissive false explicitly", () => {
      const config = {
        permissive: false,
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should handle all valid fields together", () => {
      const config = {
        codependencies: [
          "react",
          { "react-dom": "^18.0.0" },
        ],
        permissive: true,
        language: "nodejs",
        files: ["packages/**/package.json"],
        ignore: ["**/node_modules/**", "**/dist/**"],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});

describe("formatValidationErrors", () => {
  it("should format single error", () => {
    const errors: ValidationError[] = [
      {
        field: "codependencies",
        message: "Must be an array",
        suggestion: "Use array format",
      },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("✗");
    expect(formatted).toContain("Invalid configuration:");
    expect(formatted).toContain("1. codependencies: Must be an array");
    expect(formatted).toContain("💡 Use array format");
  });

  it("should format multiple errors", () => {
    const errors: ValidationError[] = [
      {
        field: "codependencies",
        message: "Must be an array",
        suggestion: "Use array format",
      },
      {
        field: "permissive",
        message: "Must be a boolean",
        suggestion: "Use true or false",
      },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("1. codependencies: Must be an array");
    expect(formatted).toContain("2. permissive: Must be a boolean");
    expect(formatted).toContain("💡 Use array format");
    expect(formatted).toContain("💡 Use true or false");
  });

  it("should format error without suggestion", () => {
    const errors: ValidationError[] = [
      {
        field: "root",
        message: "Config must be an object",
      },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("1. root: Config must be an object");
    expect(formatted).not.toContain("undefined");
  });

  it("should handle empty errors array", () => {
    const errors: ValidationError[] = [];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("Invalid configuration:");
  });

  it("should number errors correctly", () => {
    const errors: ValidationError[] = [
      { field: "field1", message: "Error 1" },
      { field: "field2", message: "Error 2" },
      { field: "field3", message: "Error 3" },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("1. field1: Error 1");
    expect(formatted).toContain("2. field2: Error 2");
    expect(formatted).toContain("3. field3: Error 3");
  });
});
