import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TEST_COVERAGE_INCLUDES } from "../../../../scripts/run/constants";

describe("scripts/run/constants", () => {
  test("includes install JavaScript entrypoints in coverage", () => {
    assert.ok(TEST_COVERAGE_INCLUDES.includes("scripts/install/**/*.js"));
  });
});
