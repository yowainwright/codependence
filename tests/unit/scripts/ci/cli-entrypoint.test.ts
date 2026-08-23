import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  errorMessage,
  isDirectCliExecution,
  runCliEntrypoint,
} from "../../../../scripts/ci/cli-entrypoint.js";

describe("scripts/ci/cli-entrypoint", () => {
  test("errorMessage formats Error instances", () => {
    assert.strictEqual((errorMessage(new Error("missing env"))), "missing env");
  });

  test("errorMessage formats non-error throws", () => {
    assert.strictEqual((errorMessage("failed")), "failed");
  });

  test("runCliEntrypoint stores the returned exit code", () => {
    const processRef = { exitCode: undefined as number | undefined };

    runCliEntrypoint(() => 2, { processRef });

    assert.strictEqual((processRef.exitCode), 2);
  });

  test("runCliEntrypoint writes a clean error and sets exit code 1", () => {
    let errors: string[] = [];
    const processRef = { exitCode: undefined as number | undefined };

    runCliEntrypoint(
      () => {
        throw new Error("VERSION is required");
      },
      {
        processRef,
        writeError: (message) => {
          errors = errors.concat(message);
        },
      },
    );

    assert.deepStrictEqual((errors), ["VERSION is required"]);
    assert.strictEqual((processRef.exitCode), 1);
  });

  test("isDirectCliExecution detects Node ESM script invocation", () => {
    const metaUrl = new URL("../../../../scripts/ci/tool-versions.js", import.meta.url).href;

    assert.strictEqual((isDirectCliExecution(metaUrl, ["node", "scripts/ci/tool-versions.js"])), true);
    assert.strictEqual((isDirectCliExecution(metaUrl, ["node", "scripts/ci/published-release.js"])), false);
    assert.strictEqual((isDirectCliExecution(metaUrl, ["node"])), false);
  });
});
