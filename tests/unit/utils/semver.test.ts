import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSemver, isWithinLevel } from "../../../src/utils/semver";

test("parseSemver => strips prefix and parses", () => {
  assert.deepStrictEqual((parseSemver("^1.2.3")), [1, 2, 3]);
});

test("parseSemver => handles no prefix", () => {
  assert.deepStrictEqual((parseSemver("1.2.3")), [1, 2, 3]);
});

test("parseSemver => handles tilde prefix", () => {
  assert.deepStrictEqual((parseSemver("~1.2.3")), [1, 2, 3]);
});

test("parseSemver => handles equality prefix", () => {
  assert.deepStrictEqual((parseSemver("==1.2.3")), [1, 2, 3]);
});

test("parseSemver => handles partial version", () => {
  assert.deepStrictEqual((parseSemver("1.2")), [1, 2, 0]);
});

test("isWithinLevel => major always returns true", () => {
  assert.strictEqual((isWithinLevel("1.0.0", "5.0.0", "major")), true);
});

test("isWithinLevel => minor allows same major", () => {
  assert.strictEqual((isWithinLevel("1.0.0", "1.5.0", "minor")), true);
});

test("isWithinLevel => minor rejects different major", () => {
  assert.strictEqual((isWithinLevel("1.0.0", "2.0.0", "minor")), false);
});

test("isWithinLevel => patch allows same minor", () => {
  assert.strictEqual((isWithinLevel("1.2.0", "1.2.5", "patch")), true);
});

test("isWithinLevel => patch rejects different minor", () => {
  assert.strictEqual((isWithinLevel("1.2.0", "1.3.0", "patch")), false);
});

test("isWithinLevel => patch rejects different major", () => {
  assert.strictEqual((isWithinLevel("1.2.0", "2.2.0", "patch")), false);
});

test("isWithinLevel => handles prefixed versions", () => {
  assert.strictEqual((isWithinLevel("^1.0.0", "1.5.0", "minor")), true);
  assert.strictEqual((isWithinLevel("~1.0.0", "2.0.0", "minor")), false);
});
