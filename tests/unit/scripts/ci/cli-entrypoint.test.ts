import { describe, expect, test } from "bun:test";
import {
  errorMessage,
  isDirectCliExecution,
  runCliEntrypoint,
} from "../../../../scripts/ci/cli-entrypoint.js";

describe("scripts/ci/cli-entrypoint", () => {
  test("errorMessage formats Error instances", () => {
    expect(errorMessage(new Error("missing env"))).toBe("missing env");
  });

  test("errorMessage formats non-error throws", () => {
    expect(errorMessage("failed")).toBe("failed");
  });

  test("runCliEntrypoint stores the returned exit code", () => {
    const processRef = { exitCode: undefined as number | undefined };

    runCliEntrypoint(() => 2, { processRef });

    expect(processRef.exitCode).toBe(2);
  });

  test("runCliEntrypoint writes a clean error and sets exit code 1", () => {
    const errors: string[] = [];
    const processRef = { exitCode: undefined as number | undefined };

    runCliEntrypoint(
      () => {
        throw new Error("VERSION is required");
      },
      {
        processRef,
        writeError: (message) => errors.push(message),
      },
    );

    expect(errors).toEqual(["VERSION is required"]);
    expect(processRef.exitCode).toBe(1);
  });

  test("isDirectCliExecution detects Node ESM script invocation", () => {
    const metaUrl = new URL("../../../../scripts/ci/tool-versions.js", import.meta.url).href;

    expect(isDirectCliExecution(metaUrl, ["node", "scripts/ci/tool-versions.js"])).toBe(true);
    expect(isDirectCliExecution(metaUrl, ["node", "scripts/ci/publish-release.js"])).toBe(false);
    expect(isDirectCliExecution(metaUrl, ["node"])).toBe(false);
  });
});
