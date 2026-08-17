import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { parseJSON, parseYAML } from "../../src/config/utils";

const PROPERTY_OPTIONS = { numRuns: 1_000 };

type YamlScalar = boolean | null | string;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  const isNotObject = typeof value !== "object";
  if (isNotObject) return false;
  const isNull = value === null;
  if (isNull) return false;
  return !Array.isArray(value);
};

const yamlKey = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/);
const yamlValue = fc.oneof(fc.boolean(), fc.constant(null), fc.string({ maxLength: 80 }));
const yamlConfig = fc.dictionary<YamlScalar>(yamlKey, yamlValue, {
  minKeys: 1,
  maxKeys: 20,
  noNullPrototype: true,
});

const serializeYaml = (config: Record<string, YamlScalar>): string =>
  Object.entries(config)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");

describe("config parser properties", () => {
  test("JSON parsing matches native object parsing", () => {
    const jsonValue = fc.jsonValue({ maxDepth: 4 });

    fc.assert(
      fc.property(jsonValue, (value) => {
        const serialized = JSON.stringify(value);
        const expected = JSON.parse(serialized);
        const parsed = parseJSON(serialized);

        assert.deepStrictEqual((parsed), isRecord(expected) ? expected : null);
      }),
      PROPERTY_OPTIONS,
    );
  });

  test("JSON parsing is total for arbitrary text", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (content) => {
        const parsed = parseJSON(content);
        assert.strictEqual((parsed === null || isRecord(parsed)), true);
      }),
      PROPERTY_OPTIONS,
    );
  });

  test("YAML parsing round-trips supported scalar mappings", () => {
    fc.assert(
      fc.property(yamlConfig, (config) => {
        assert.deepStrictEqual((parseYAML(serializeYaml(config))), config);
      }),
      PROPERTY_OPTIONS,
    );
  });

  test("YAML parsing is total for arbitrary text", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (content) => {
        const parsed = parseYAML(content);
        assert.strictEqual((parsed === null || isRecord(parsed)), true);
      }),
      PROPERTY_OPTIONS,
    );
  });
});
