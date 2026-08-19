import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createEnumValidator, createArrayValidator } from "../../../src/config/validation";

describe("createEnumValidator", () => {
  const validateColor = createEnumValidator("color", ["red", "green", "blue"]);

  test("returns empty array when field not present", () => {
    const result = validateColor({ name: "test" });
    assert.deepStrictEqual(result, []);
  });

  test("returns empty array for valid value", () => {
    assert.deepStrictEqual(validateColor({ color: "red" }), []);
    assert.deepStrictEqual(validateColor({ color: "green" }), []);
    assert.deepStrictEqual(validateColor({ color: "blue" }), []);
  });

  test("returns error for invalid value", () => {
    const result = validateColor({ color: "purple" });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].field, "color");
    assert.strictEqual(result[0].message, 'Invalid color "purple"');
    assert.strictEqual(result[0].suggestion, "Must be one of: red, green, blue");
  });

  test("returns error for non-string value", () => {
    const result = validateColor({ color: 123 });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].field, "color");
    assert.strictEqual(result[0].message, '"color" must be a string, got number');
    assert.strictEqual(result[0].suggestion, "Use one of: red, green, blue");
  });

  test("returns error for boolean value", () => {
    const result = validateColor({ color: true });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].message, '"color" must be a string, got boolean');
  });

  test("returns error for null value", () => {
    const result = validateColor({ color: null });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].message, '"color" must be a string, got object');
  });

  test("works with single-value enum", () => {
    const validateSingle = createEnumValidator("mode", ["strict"]);

    assert.deepStrictEqual(validateSingle({ mode: "strict" }), []);
    assert.strictEqual(validateSingle({ mode: "loose" }).length, 1);
  });
});

describe("createArrayValidator", () => {
  const validateTags = createArrayValidator("tags", "tag", '{"tags": ["a", "b"]}');

  test("returns empty array when field not present", () => {
    const result = validateTags({ name: "test" });
    assert.deepStrictEqual(result, []);
  });

  test("returns empty array for valid string array", () => {
    assert.deepStrictEqual(validateTags({ tags: ["a", "b"] }), []);
  });

  test("returns empty array for empty array", () => {
    assert.deepStrictEqual(validateTags({ tags: [] }), []);
  });

  test("returns error for non-array value", () => {
    const result = validateTags({ tags: "not-an-array" });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].field, "tags");
    assert.strictEqual(result[0].message, '"tags" must be an array, got string');
    assert.strictEqual(result[0].suggestion, 'Use array format: {"tags": ["a", "b"]}');
  });

  test("returns error for object value", () => {
    const result = validateTags({ tags: { a: 1 } });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].message, '"tags" must be an array, got object');
  });

  test("returns error for array with non-string items", () => {
    const result = validateTags({ tags: ["valid", 123, true] });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].field, "tags");
    assert.strictEqual(result[0].message, "All tag patterns must be strings");
    assert.strictEqual(result[0].suggestion, "Remove non-string values from tags array");
  });

  test("returns error for number value", () => {
    const result = validateTags({ tags: 42 });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].message, '"tags" must be an array, got number');
  });

  test("uses custom item label in error message", () => {
    const validatePaths = createArrayValidator("paths", "file path", '{"paths": ["./src"]}');
    const result = validatePaths({ paths: ["valid", 123] });

    assert.strictEqual(result[0].message, "All file path patterns must be strings");
  });
});
