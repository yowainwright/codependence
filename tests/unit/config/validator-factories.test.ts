import { describe, test, expect } from "bun:test";
import {
  createEnumValidator,
  createArrayValidator,
} from "../../../src/config/validator";

describe("createEnumValidator", () => {
  const validateColor = createEnumValidator("color", ["red", "green", "blue"]);

  test("returns empty array when field not present", () => {
    const result = validateColor({ name: "test" });
    expect(result).toEqual([]);
  });

  test("returns empty array for valid value", () => {
    expect(validateColor({ color: "red" })).toEqual([]);
    expect(validateColor({ color: "green" })).toEqual([]);
    expect(validateColor({ color: "blue" })).toEqual([]);
  });

  test("returns error for invalid value", () => {
    const result = validateColor({ color: "purple" });

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("color");
    expect(result[0].message).toBe('Invalid color "purple"');
    expect(result[0].suggestion).toBe("Must be one of: red, green, blue");
  });

  test("returns error for non-string value", () => {
    const result = validateColor({ color: 123 });

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("color");
    expect(result[0].message).toBe('"color" must be a string, got number');
    expect(result[0].suggestion).toBe("Use one of: red, green, blue");
  });

  test("returns error for boolean value", () => {
    const result = validateColor({ color: true });

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('"color" must be a string, got boolean');
  });

  test("returns error for null value", () => {
    const result = validateColor({ color: null });

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('"color" must be a string, got object');
  });

  test("works with single-value enum", () => {
    const validateSingle = createEnumValidator("mode", ["strict"]);

    expect(validateSingle({ mode: "strict" })).toEqual([]);
    expect(validateSingle({ mode: "loose" })).toHaveLength(1);
  });
});

describe("createArrayValidator", () => {
  const validateTags = createArrayValidator("tags", "tag", '{"tags": ["a", "b"]}');

  test("returns empty array when field not present", () => {
    const result = validateTags({ name: "test" });
    expect(result).toEqual([]);
  });

  test("returns empty array for valid string array", () => {
    expect(validateTags({ tags: ["a", "b"] })).toEqual([]);
  });

  test("returns empty array for empty array", () => {
    expect(validateTags({ tags: [] })).toEqual([]);
  });

  test("returns error for non-array value", () => {
    const result = validateTags({ tags: "not-an-array" });

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("tags");
    expect(result[0].message).toBe('"tags" must be an array, got string');
    expect(result[0].suggestion).toBe('Use array format: {"tags": ["a", "b"]}');
  });

  test("returns error for object value", () => {
    const result = validateTags({ tags: { a: 1 } });

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('"tags" must be an array, got object');
  });

  test("returns error for array with non-string items", () => {
    const result = validateTags({ tags: ["valid", 123, true] });

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("tags");
    expect(result[0].message).toBe("All tag patterns must be strings");
    expect(result[0].suggestion).toBe("Remove non-string values from tags array");
  });

  test("returns error for number value", () => {
    const result = validateTags({ tags: 42 });

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('"tags" must be an array, got number');
  });

  test("uses custom item label in error message", () => {
    const validatePaths = createArrayValidator("paths", "file path", '{"paths": ["./src"]}');
    const result = validatePaths({ paths: ["valid", 123] });

    expect(result[0].message).toBe("All file path patterns must be strings");
  });
});
