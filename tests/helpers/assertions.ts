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

const isMatcher = (value: unknown): value is Matcher => {
  const hasObjectShape = typeof value === "object" && value !== null;
  if (!hasObjectShape) return false;
  return MATCHER in value;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  const hasObjectShape = typeof value === "object" && value !== null;
  if (!hasObjectShape) return false;
  const prototype = Object.getPrototypeOf(value);
  const isPlainPrototype = prototype === Object.prototype || prototype === null;
  return isPlainPrototype;
};

const matchesConstructor = (actual: unknown, constructor: Function): boolean => {
  const actualType = typeof actual;
  switch (constructor) {
    case String:
      return actualType === "string";
    case Number:
      return actualType === "number";
    case Boolean:
      return actualType === "boolean";
    case Function:
      return actualType === "function";
    case Object: {
      const hasObjectShape = actualType === "object" && actual !== null;
      return hasObjectShape;
    }
    default:
      return actual instanceof constructor;
  }
};

const matchesObject = (
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  exact: boolean,
): boolean => {
  const expectedEntries = Object.entries(expected);
  const hasMatchingEntries = expectedEntries.every(([key, value]) => matches(actual[key], value));
  if (!hasMatchingEntries) return false;
  if (!exact) return true;
  const actualKeyCount = Object.keys(actual).length;
  return actualKeyCount === expectedEntries.length;
};

const matches = (actual: unknown, expected: unknown): boolean => {
  if (isMatcher(expected)) {
    if (expected[MATCHER] === "any") return matchesConstructor(actual, expected.value);
    if (expected[MATCHER] === "stringContaining") {
      const isString = typeof actual === "string";
      if (!isString) return false;
      return actual.includes(expected.value);
    }
    if (expected[MATCHER] === "stringMatching") {
      const isString = typeof actual === "string";
      if (!isString) return false;
      return expected.value.test(actual);
    }
    const isObject = isPlainObject(actual);
    if (!isObject) return false;
    return matchesObject(actual, expected.value, false);
  }

  if (Array.isArray(expected)) {
    const isArray = Array.isArray(actual);
    if (!isArray) return false;
    const hasExpectedLength = actual.length === expected.length;
    if (!hasExpectedLength) return false;
    return expected.every((value, index) => matches(actual[index], value));
  }

  if (isPlainObject(expected)) {
    const isObject = isPlainObject(actual);
    if (!isObject) return false;
    return matchesObject(actual, expected, true);
  }

  return isDeepStrictEqual(actual, expected);
};

const expectedErrorMessage = (expected: unknown): string | undefined => {
  if (typeof expected === "string") return expected;
  if (expected instanceof Error) return expected.message;
  return undefined;
};

const errorMatches = (error: unknown, expected?: unknown): boolean => {
  if (expected === undefined) return true;
  if (typeof expected === "function") return error instanceof expected;

  const message = error instanceof Error ? error.message : String(error);
  const expectedMessage = expectedErrorMessage(expected);
  if (expectedMessage !== undefined) return message.includes(expectedMessage);
  if (expected instanceof RegExp) return expected.test(message);
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

export const assertRejects = async (
  promise: PromiseLike<unknown>,
  expected?: unknown,
): Promise<void> => {
  await assert.rejects(promise, (error) => errorMatches(error, expected));
};
