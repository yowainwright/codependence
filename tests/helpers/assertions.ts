import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

const MATCHER = Symbol("matcher");

type Matcher =
  | { readonly [MATCHER]: "any"; readonly value: Function }
  | { readonly [MATCHER]: "objectContaining"; readonly value: Record<string, unknown> }
  | { readonly [MATCHER]: "stringContaining"; readonly value: string }
  | { readonly [MATCHER]: "stringMatching"; readonly value: RegExp };

interface MockCall {
  readonly arguments: readonly unknown[];
}

interface TrackedMock {
  readonly mock: {
    readonly calls: readonly MockCall[];
    callCount(): number;
  };
}

const isMatcher = (value: unknown): value is Matcher =>
  typeof value === "object" && value !== null && MATCHER in value;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const matchesConstructor = (actual: unknown, constructor: Function): boolean => {
  if (constructor === String) return typeof actual === "string";
  if (constructor === Number) return typeof actual === "number";
  if (constructor === Boolean) return typeof actual === "boolean";
  if (constructor === Function) return typeof actual === "function";
  if (constructor === Object) return typeof actual === "object" && actual !== null;
  return actual instanceof constructor;
};

const matchesObject = (
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  exact: boolean,
): boolean => {
  const expectedEntries = Object.entries(expected);
  const hasMatchingEntries = expectedEntries.every(([key, value]) => matches(actual[key], value));
  if (!hasMatchingEntries || !exact) return hasMatchingEntries;
  return Object.keys(actual).length === expectedEntries.length;
};

const matches = (actual: unknown, expected: unknown): boolean => {
  if (isMatcher(expected)) {
    if (expected[MATCHER] === "any") return matchesConstructor(actual, expected.value);
    if (expected[MATCHER] === "stringContaining") {
      return typeof actual === "string" && actual.includes(expected.value);
    }
    if (expected[MATCHER] === "stringMatching") {
      return typeof actual === "string" && expected.value.test(actual);
    }
    return isPlainObject(actual) && matchesObject(actual, expected.value, false);
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((value, index) => matches(actual[index], value));
  }

  if (isPlainObject(expected)) {
    return isPlainObject(actual) && matchesObject(actual, expected, true);
  }

  return isDeepStrictEqual(actual, expected);
};

const errorMatches = (error: unknown, expected?: unknown): boolean => {
  if (expected === undefined) return true;
  if (typeof expected === "function") return error instanceof expected;

  const message = error instanceof Error ? error.message : String(error);
  if (typeof expected === "string") return message.includes(expected);
  if (expected instanceof RegExp) return expected.test(message);
  if (expected instanceof Error) return message.includes(expected.message);
  return matches(error, expected);
};

export const match = {
  any: (value: Function): Matcher => ({ [MATCHER]: "any", value }),
  objectContaining: (value: Record<string, unknown>): Matcher => ({
    [MATCHER]: "objectContaining",
    value,
  }),
  stringContaining: (value: string): Matcher => ({ [MATCHER]: "stringContaining", value }),
  stringMatching: (value: RegExp): Matcher => ({ [MATCHER]: "stringMatching", value }),
};

export const assertMatches = (actual: unknown, expected: unknown): void => {
  assert.ok(matches(actual, expected), "received value did not match the expected structure");
};

export const assertCalledWith = (mockFunction: TrackedMock, ...expected: unknown[]): void => {
  const matchingCall = mockFunction.mock.calls.some((call) => matches(call.arguments, expected));
  assert.ok(matchingCall, "mock was not called with the expected arguments");
};

export const assertNthCalledWith = (
  mockFunction: TrackedMock,
  callNumber: number,
  ...expected: unknown[]
): void => {
  const call = mockFunction.mock.calls[callNumber - 1];
  assert.ok(call, `mock was not called ${callNumber} times`);
  assertMatches(call.arguments, expected);
};

export const assertContainsEqual = (actual: readonly unknown[], expected: unknown): void => {
  assert.ok(actual.some((value) => matches(value, expected)));
};

export const assertNotContainsEqual = (actual: readonly unknown[], expected: unknown): void => {
  assert.ok(actual.every((value) => !matches(value, expected)));
};

export const assertMatchObject = (
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): void => {
  assert.ok(matchesObject(actual, expected, false));
};

export const assertProperty = (
  actual: unknown,
  path: string,
  ...expected: readonly unknown[]
): void => {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!isPlainObject(current)) return undefined;
    return current[key];
  }, actual);
  assert.notStrictEqual(value, undefined);
  if (expected.length > 0) assertMatches(value, expected[0]);
};

export const assertThrows = (callback: () => unknown, expected?: unknown): void => {
  assert.throws(callback, (error) => errorMatches(error, expected));
};

export const assertRejects = async (promise: PromiseLike<unknown>, expected?: unknown): Promise<void> => {
  await assert.rejects(promise, (error) => errorMatches(error, expected));
};
