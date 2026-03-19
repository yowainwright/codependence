import { expect, test } from "bun:test";
import { parseSemver, isWithinLevel } from "../../../src/utils/semver";

test("parseSemver => strips prefix and parses", () => {
  expect(parseSemver("^1.2.3")).toEqual([1, 2, 3]);
});

test("parseSemver => handles no prefix", () => {
  expect(parseSemver("1.2.3")).toEqual([1, 2, 3]);
});

test("parseSemver => handles tilde prefix", () => {
  expect(parseSemver("~1.2.3")).toEqual([1, 2, 3]);
});

test("parseSemver => handles partial version", () => {
  expect(parseSemver("1.2")).toEqual([1, 2, 0]);
});

test("isWithinLevel => major always returns true", () => {
  expect(isWithinLevel("1.0.0", "5.0.0", "major")).toBe(true);
});

test("isWithinLevel => minor allows same major", () => {
  expect(isWithinLevel("1.0.0", "1.5.0", "minor")).toBe(true);
});

test("isWithinLevel => minor rejects different major", () => {
  expect(isWithinLevel("1.0.0", "2.0.0", "minor")).toBe(false);
});

test("isWithinLevel => patch allows same minor", () => {
  expect(isWithinLevel("1.2.0", "1.2.5", "patch")).toBe(true);
});

test("isWithinLevel => patch rejects different minor", () => {
  expect(isWithinLevel("1.2.0", "1.3.0", "patch")).toBe(false);
});

test("isWithinLevel => patch rejects different major", () => {
  expect(isWithinLevel("1.2.0", "2.2.0", "patch")).toBe(false);
});

test("isWithinLevel => handles prefixed versions", () => {
  expect(isWithinLevel("^1.0.0", "1.5.0", "minor")).toBe(true);
  expect(isWithinLevel("~1.0.0", "2.0.0", "minor")).toBe(false);
});
