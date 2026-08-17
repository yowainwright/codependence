import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateConfig, formatValidationErrors } from "../../../src/config/validator";
import type { ValidationError } from "../../../src/config/types";

describe("validateConfig", () => {
  describe("valid configurations", () => {
    it("validates named manifest config", () => {
      const config = {
        config: {
          web: {
            name: "@project/web",
            path: "packages/web/package.json",
            manager: "pnpm",
            mode: "precise",
          },
        },
      };

      assert.deepStrictEqual((validateConfig(config)), { valid: true, errors: [] });
    });

    it("should validate minimal config with codependencies array", () => {
      const config = {
        codependencies: ["react", "lodash"],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should validate config with codependencies objects", () => {
      const config = {
        codependencies: [{ react: "^18.0.0" }, { lodash: "4.17.21" }],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should validate config with mixed codependencies format", () => {
      const config = {
        codependencies: ["react", { lodash: "4.17.21" }, "typescript"],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should validate config with permissive only", () => {
      const config = {
        permissive: true,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should validate config with all optional fields", () => {
      const config = {
        codependencies: ["react"],
        permissive: false,
        language: "nodejs",
        files: ["**/package.json"],
        ignore: ["**/node_modules/**"],
        level: "minor",
        mode: "verbose",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should validate config with python language", () => {
      const config = {
        codependencies: ["django"],
        language: "python",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should validate config with go language", () => {
      const config = {
        codependencies: ["github.com/gin-gonic/gin"],
        language: "go",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should validate config with new provider languages", () => {
      const languages = ["rust", "docker", "github-actions"];

      languages.forEach((language) => {
        const config = {
          codependencies: ["example"],
          language,
        };
        const result = validateConfig(config);

        assert.strictEqual((result.valid), true);
      });
    });
  });

  describe("root object validation", () => {
    it("accepts manager-only targets that use default policy", () => {
      assert.strictEqual(validateConfig({
          $schema: "https://unpkg.com/codependence/src/schema.json",
          targets: [{ manager: "bun" }],
        }).valid, true);
      assert.strictEqual(validateConfig({
          config: { web: { manager: "pnpm", path: "packages/web/package.json" } },
        }).valid, true);
    });

    it("rejects config entries without a manifest path", () => {
      const result = validateConfig({
        config: { web: { manager: "pnpm", mode: "precise" } },
      });

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "config.web.path");
    });

    it("should reject non-object config", () => {
      const result = validateConfig("invalid");

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "root");
      assert.strictEqual((result.errors[0].message), "Configuration must be a JSON object");
      assert.strictEqual((result.errors[0].suggestion), 'Wrap your config in {}: {"codependencies": [...]}');
    });

    it("should reject null config", () => {
      const result = validateConfig(null);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "root");
    });

    it("should reject array config", () => {
      const result = validateConfig(["react"]);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "root");
    });

    it("should reject number config", () => {
      const result = validateConfig(123);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "root");
    });
  });

  describe("required fields validation", () => {
    it("should reject config without codependencies or permissive", () => {
      const config = {
        language: "nodejs",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      const requiredError = result.errors.find((e) => e.message.includes("either"));
      assert.notStrictEqual((requiredError), undefined);
      assert.strictEqual((requiredError?.field), "root");
      assert.strictEqual((requiredError?.suggestion), 'Add {"codependencies": ["package-name"]}, {"permissive": true}, or {"mode": "precise"}');
    });

    it("should reject empty object config", () => {
      const config = {};

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "root");
    });

    it("should allow supplemental config when policy is not required", () => {
      const config = {
        files: ["package.json"],
        rootDir: ".",
      };

      const result = validateConfig(config, { requirePolicy: false });

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should still validate supplemental config shape when policy is not required", () => {
      const config = {
        files: "package.json",
      };

      const result = validateConfig(config, { requirePolicy: false });

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "files");
    });
  });

  describe("codependencies validation", () => {
    it("should reject non-array codependencies", () => {
      const config = {
        codependencies: "react",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "codependencies");
      assert.strictEqual((result.errors[0].message), '"codependencies" must be an array, got string');
      assert.strictEqual((result.errors[0].suggestion), 'Change to array format: {"codependencies": ["package1", "package2"]}');
    });

    it("should reject object codependencies", () => {
      const config = {
        codependencies: { react: "^18.0.0" },
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "codependencies");
      assert.strictEqual((result.errors[0].message), '"codependencies" must be an array, got object');
    });

    it("should reject empty string package names", () => {
      const config = {
        codependencies: ["react", "", "lodash"],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "codependencies[1]");
      assert.strictEqual((result.errors[0].message), "Package name cannot be empty string");
      assert.strictEqual((result.errors[0].suggestion), "Remove empty strings from the codependencies array");
    });

    it("should reject empty objects in codependencies", () => {
      const config = {
        codependencies: [{}, "react"],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "codependencies[0]");
      assert.strictEqual((result.errors[0].message), "Object in codependencies must have exactly one key, found 0");
      assert.strictEqual((result.errors[0].suggestion), "Remove empty objects from codependencies array");
    });

    it("should reject objects with multiple keys", () => {
      const config = {
        codependencies: [{ react: "^18.0.0", lodash: "4.17.21" }],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "codependencies[0]");
      assert.strictEqual((result.errors[0].message), "Object in codependencies must have exactly one key, found 2");
      assert.ok((result.errors[0].suggestion).includes("Split into multiple objects"));
    });

    it("should reject non-string version values", () => {
      const config = {
        codependencies: [{ react: 18 }],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "codependencies[0]");
      assert.strictEqual((result.errors[0].message), "Version value must be a string");
      assert.ok((result.errors[0].suggestion).includes('Change {"react": 18}'));
    });

    it("should reject number items in codependencies", () => {
      const config = {
        codependencies: ["react", 123],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "codependencies[1]");
      assert.strictEqual((result.errors[0].message), "Invalid item type: number");
    });

    it("should reject boolean items in codependencies", () => {
      const config = {
        codependencies: ["react", true],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "codependencies[1]");
      assert.strictEqual((result.errors[0].message), "Invalid item type: boolean");
    });
  });

  describe("permissive validation", () => {
    it("should reject non-boolean permissive", () => {
      const config = {
        permissive: "true",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "permissive");
      assert.strictEqual((result.errors[0].message), '"permissive" must be a boolean, got string');
      assert.strictEqual((result.errors[0].suggestion), 'Change to: {"permissive": true} or {"permissive": false}');
    });

    it("should reject number permissive", () => {
      const config = {
        permissive: 1,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "permissive");
      assert.strictEqual((result.errors[0].message), '"permissive" must be a boolean, got number');
    });
  });

  describe("language validation", () => {
    it("should reject non-string language", () => {
      const config = {
        codependencies: ["react"],
        language: 123,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "language");
      assert.strictEqual((result.errors[0].message), '"language" must be a string, got number');
      assert.strictEqual((result.errors[0].suggestion), "Use one of: nodejs, python, go, rust, docker, github-actions");
    });

    it("should reject invalid language value", () => {
      const config = {
        codependencies: ["react"],
        language: "ruby",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "language");
      assert.strictEqual((result.errors[0].message), 'Invalid language "ruby"');
      assert.strictEqual((result.errors[0].suggestion), "Must be one of: nodejs, python, go, rust, docker, github-actions");
    });

    it("should reject boolean language", () => {
      const config = {
        codependencies: ["react"],
        language: true,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "language");
      assert.strictEqual((result.errors[0].message), '"language" must be a string, got boolean');
    });
  });

  describe("files validation", () => {
    it("should reject non-array files", () => {
      const config = {
        codependencies: ["react"],
        files: "**/package.json",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "files");
      assert.strictEqual((result.errors[0].message), '"files" must be an array, got string');
      assert.strictEqual((result.errors[0].suggestion), 'Use array format: {"files": ["**/package.json"]}');
    });

    it("should reject non-string values in files array", () => {
      const config = {
        codependencies: ["react"],
        files: ["**/package.json", 123, true],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "files");
      assert.strictEqual((result.errors[0].message), "All file patterns must be strings");
      assert.strictEqual((result.errors[0].suggestion), "Remove non-string values from files array");
    });

    it("should reject object files", () => {
      const config = {
        codependencies: ["react"],
        files: { pattern: "**/*.json" },
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "files");
      assert.strictEqual((result.errors[0].message), '"files" must be an array, got object');
    });
  });

  describe("ignore validation", () => {
    it("should reject non-array ignore", () => {
      const config = {
        codependencies: ["react"],
        ignore: "**/node_modules/**",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "ignore");
      assert.strictEqual((result.errors[0].message), '"ignore" must be an array, got string');
      assert.strictEqual((result.errors[0].suggestion), 'Use array format: {"ignore": ["**/node_modules/**"]}');
    });

    it("should reject non-string values in ignore array", () => {
      const config = {
        codependencies: ["react"],
        ignore: ["**/node_modules/**", 123],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "ignore");
      assert.strictEqual((result.errors[0].message), "All ignore patterns must be strings");
      assert.strictEqual((result.errors[0].suggestion), "Remove non-string values from ignore array");
    });

    it("should reject object ignore", () => {
      const config = {
        codependencies: ["react"],
        ignore: { pattern: "node_modules" },
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "ignore");
      assert.strictEqual((result.errors[0].message), '"ignore" must be an array, got object');
    });
  });

  describe("level validation", () => {
    it("should validate valid level values", () => {
      const levels = ["patch", "minor", "major"];
      levels.forEach((level) => {
        const config = { codependencies: ["react"], level };
        const result = validateConfig(config);
        assert.strictEqual((result.valid), true);
      });
    });

    it("should reject non-string level", () => {
      const config = { codependencies: ["react"], level: 123 };
      const result = validateConfig(config);
      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "level");
      assert.strictEqual((result.errors[0].message), '"level" must be a string, got number');
    });

    it("should reject invalid level value", () => {
      const config = { codependencies: ["react"], level: "huge" };
      const result = validateConfig(config);
      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "level");
      assert.strictEqual((result.errors[0].message), 'Invalid level "huge"');
    });
  });

  describe("mode validation", () => {
    it("should validate valid mode values", () => {
      const modes = ["verbose", "precise"];
      modes.forEach((mode) => {
        const config = { codependencies: ["react"], mode };
        const result = validateConfig(config);
        assert.strictEqual((result.valid), true);
      });
    });

    it("should accept mode=precise as sufficient config", () => {
      const config = { mode: "precise" };
      const result = validateConfig(config);
      assert.strictEqual((result.valid), true);
    });

    it("should reject non-string mode", () => {
      const config = { codependencies: ["react"], mode: true };
      const result = validateConfig(config);
      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "mode");
      assert.strictEqual((result.errors[0].message), '"mode" must be a string, got boolean');
    });

    it("should reject invalid mode value", () => {
      const config = { codependencies: ["react"], mode: "strict" };
      const result = validateConfig(config);
      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "mode");
      assert.strictEqual((result.errors[0].message), 'Invalid mode "strict"');
    });
  });

  describe("supplemental option validation", () => {
    it("should reject non-string path fields", () => {
      const config = {
        codependencies: ["react"],
        rootDir: 123,
        outputFile: false,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.deepStrictEqual((result.errors), [
        {
          field: "rootDir",
          message: '"rootDir" must be a string, got number',
          suggestion: 'Use a string value for "rootDir"',
        },
        {
          field: "outputFile",
          message: '"outputFile" must be a string, got boolean',
          suggestion: 'Use a string value for "outputFile"',
        },
      ]);
    });

    it("should reject non-boolean command option fields", () => {
      const config = {
        codependencies: ["react"],
        update: "yes",
        noCache: 1,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.deepStrictEqual((result.errors), [
        {
          field: "update",
          message: '"update" must be a boolean, got string',
          suggestion: 'Use true or false for "update"',
        },
        {
          field: "noCache",
          message: '"noCache" must be a boolean, got number',
          suggestion: 'Use true or false for "noCache"',
        },
      ]);
    });
  });

  describe("unknown fields validation", () => {
    it("should reject unknown fields", () => {
      const config = {
        codependencies: ["react"],
        unknown: "field",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors).length, 1);
      assert.strictEqual((result.errors[0].field), "root");
      assert.strictEqual((result.errors[0].message), "Unknown field(s): unknown");
      assert.ok((result.errors[0].suggestion).includes("Valid fields are:"));
      assert.ok((result.errors[0].suggestion).includes("codependencies"));
      assert.ok((result.errors[0].suggestion).includes("outputFile"));
    });

    it("should reject multiple unknown fields", () => {
      const config = {
        codependencies: ["react"],
        unknown1: "field",
        unknown2: "field",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.ok((result.errors[0].message).includes("unknown1"));
      assert.ok((result.errors[0].message).includes("unknown2"));
    });

    it("should not allow random properties", () => {
      const config = {
        codependencies: ["react"],
        randomProperty: 123,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.ok((result.errors[0].message).includes("randomProperty"));
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

      assert.strictEqual((result.valid), false);
      assert.ok((result.errors.length) > 1);
    });

    it("should handle multiple codependencies errors", () => {
      const config = {
        codependencies: ["", 123, { react: 18 }],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.ok((result.errors.length) >= 3);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined config", () => {
      const result = validateConfig(undefined);

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "root");
    });

    it("should handle empty array codependencies", () => {
      const config = {
        codependencies: [],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should handle permissive false explicitly", () => {
      const config = {
        permissive: false,
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });

    it("should handle all valid fields together", () => {
      const config = {
        codependencies: ["react", { "react-dom": "^18.0.0" }],
        permissive: true,
        language: "nodejs",
        files: ["packages/**/package.json"],
        ignore: ["**/node_modules/**", "**/dist/**"],
        level: "major",
        mode: "precise",
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), true);
      assert.deepStrictEqual((result.errors), []);
    });
  });

  describe("manager targets", () => {
    it("accepts independent manager policies", () => {
      const config = {
        update: true,
        targets: [
          {
            manager: "bun",
            files: ["package.json"],
            codependencies: ["typescript"],
          },
          {
            manager: "github-actions",
            files: [".github/workflows/*.yml"],
            mode: "precise",
          },
        ],
      };

      assert.deepStrictEqual((validateConfig(config)), { valid: true, errors: [] });
    });

    it("accepts lockfile policies", () => {
      const config = {
        lockfile: true,
        targets: [
          { manager: "bun", mode: "precise" },
          { manager: "go", lockfile: false, mode: "precise" },
        ],
      };

      assert.deepStrictEqual((validateConfig(config)), { valid: true, errors: [] });
    });

    it("rejects unsafe lockfile paths", () => {
      const result = validateConfig({
        targets: [
          { manager: "bun", lockfile: [], mode: "precise" },
          { manager: "go", lockfile: "../go.sum", mode: "precise" },
          { manager: "uv", lockfile: "C:\\repo\\uv.lock", mode: "precise" },
        ],
      });

      assert.strictEqual((result.valid), false);
      assert.deepStrictEqual((result.errors.map(({ field }) => field)), [
        "targets[0].lockfile",
        "targets[1].lockfile",
        "targets[2].lockfile",
      ]);
    });

    it("rejects non-array targets", () => {
      const result = validateConfig({ targets: "bun" });

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "targets");
      assert.ok((result.errors[0].message).includes("must be an array"));
    });

    it("rejects empty targets", () => {
      const result = validateConfig({ targets: [] });

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "targets");
      assert.ok((result.errors[0].message).includes("at least one target"));
    });

    it("rejects non-object targets", () => {
      const result = validateConfig({ targets: ["bun"] });

      assert.strictEqual((result.valid), false);
      assert.strictEqual((result.errors[0].field), "targets[0]");
      assert.ok((result.errors[0].message).includes("configuration object"));
    });

    it("rejects invalid and missing managers", () => {
      const config = {
        targets: [{ manager: "composer", mode: "precise" }, { mode: "precise" }],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.ok((result.errors.map(({ field }) => field)).includes("targets[0].manager"));
      assert.ok((result.errors.map(({ field }) => field)).includes("targets[1].manager"));
    });

    it("rejects target policy fields at the root", () => {
      const config = {
        mode: "precise",
        targets: [{ manager: "bun", mode: "precise" }],
      };

      const result = validateConfig(config);

      assert.strictEqual((result.valid), false);
      assert.ok((result.errors[0].message).includes("cannot be used beside"));
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

    assert.ok((formatted).includes("x"));
    assert.ok((formatted).includes("Invalid configuration:"));
    assert.ok((formatted).includes("1. codependencies: Must be an array"));
    assert.ok((formatted).includes("> Use array format"));
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

    assert.ok((formatted).includes("1. codependencies: Must be an array"));
    assert.ok((formatted).includes("2. permissive: Must be a boolean"));
    assert.ok((formatted).includes("> Use array format"));
    assert.ok((formatted).includes("> Use true or false"));
  });

  it("should format error without suggestion", () => {
    const errors: ValidationError[] = [
      {
        field: "root",
        message: "Config must be an object",
      },
    ];

    const formatted = formatValidationErrors(errors);

    assert.ok((formatted).includes("1. root: Config must be an object"));
    assert.ok(!(formatted).includes("undefined"));
  });

  it("should handle empty errors array", () => {
    const errors: ValidationError[] = [];

    const formatted = formatValidationErrors(errors);

    assert.ok((formatted).includes("Invalid configuration:"));
  });

  it("should number errors correctly", () => {
    const errors: ValidationError[] = [
      { field: "field1", message: "Error 1" },
      { field: "field2", message: "Error 2" },
      { field: "field3", message: "Error 3" },
    ];

    const formatted = formatValidationErrors(errors);

    assert.ok((formatted).includes("1. field1: Error 1"));
    assert.ok((formatted).includes("2. field2: Error 2"));
    assert.ok((formatted).includes("3. field3: Error 3"));
  });
});
