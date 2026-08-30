import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { installArgs, runInstallCommand } from "../../../../scripts/install/index.js";

const createErrorRecorder = () => {
  const errors: string[] = [];
  const writeError = (message: string): void => {
    errors[errors.length] = message;
  };
  return { errors, writeError };
};

describe("scripts/install/index", () => {
  test("builds global legibility install arguments", () => {
    assert.deepStrictEqual(installArgs("/repo/install.js", "codex", false), [
      "/repo/install.js",
      "--target",
      "codex",
      "--force",
    ]);
  });

  test("builds local legibility install arguments", () => {
    assert.deepStrictEqual(installArgs("/repo/install.js", "claude", true), [
      "/repo/install.js",
      "--target",
      "claude",
      "--force",
      "--path",
      ".claude/rules",
    ]);
  });

  test("rejects unsupported install targets", () => {
    const { errors, writeError } = createErrorRecorder();
    const code = runInstallCommand({
      argv: ["invalid"],
      writeError,
    });

    assert.strictEqual(code, 1);
    assert.deepStrictEqual(errors, [
      "Usage: node scripts/install/index.js [agents|claude|codex] [--local]",
    ]);
  });

  test("rejects missing legibility installers", () => {
    const { errors, writeError } = createErrorRecorder();
    const code = runInstallCommand({
      argv: ["agents"],
      exists: () => false,
      installer: "/repo/missing.js",
      writeError,
    });

    assert.strictEqual(code, 1);
    assert.deepStrictEqual(errors, [
      "eslint-plugin-legibility is not installed. Run nub install first.",
    ]);
  });

  test("runs the resolved legibility installer", () => {
    const calls: string[][] = [];
    const code = runInstallCommand({
      argv: ["codex", "--local"],
      exists: () => true,
      installer: "/repo/install.js",
      spawn: (command, args) => {
        calls[calls.length] = [command].concat(args);
        return { status: 0 };
      },
    });

    assert.strictEqual(code, 0);
    assert.deepStrictEqual(calls, [
      [
        process.execPath,
        "/repo/install.js",
        "--target",
        "codex",
        "--force",
        "--path",
        ".codex/skills",
      ],
    ]);
  });

  test("reports installer spawn errors", () => {
    const { errors, writeError } = createErrorRecorder();
    const code = runInstallCommand({
      argv: ["agents"],
      exists: () => true,
      installer: "/repo/install.js",
      spawn: () => ({ error: new Error("spawn failed"), status: null }),
      writeError,
    });

    assert.strictEqual(code, 1);
    assert.deepStrictEqual(errors, ["spawn failed"]);
  });
});
