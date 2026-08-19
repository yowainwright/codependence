import { afterEach, describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertRejects, assertThrows } from "../helpers/assertions";
import * as host from "../../src/cli/utils";
import { normalizeBinaryArgv } from "../../src/cli/utils";
import * as binary from "../../src/cli";
import { logger } from "../../src/observability";

const runMock = mock.fn(async () => undefined);

describe("binary host", () => {
  let restoreHost: (() => void) | undefined;

  afterEach(() => {
    restoreHost?.();
    restoreHost = undefined;
  });

  test("returns no adapters before configuration", () => {
    assert.strictEqual(host.hasBinaryHost(), false);
    assert.strictEqual(host.binaryExecFile(), undefined);
    assert.strictEqual(host.runBinaryExecFileSync("go", ["mod", "tidy"], "/repo"), false);
    assert.strictEqual(host.askBinaryHost("Continue?"), undefined);
  });

  test("bridges async, sync, and prompt calls", async () => {
    const exec = mock.fn(async () => '{"stdout":"1.2.3","stderr":"warning"}');
    const execSync = mock.fn(() => '{"stdout":"done","stderr":""}');
    const question = mock.fn(async () => "yes");
    restoreHost = host.configureBinaryHost(exec, execSync, question);

    const execFile = host.binaryExecFile();
    const result = await execFile?.("npm", ["view"], { cwd: "/repo", encoding: "utf8" });

    assert.strictEqual(host.hasBinaryHost(), true);
    assert.deepStrictEqual(result, { stdout: "1.2.3", stderr: "warning" });
    assertCalledWith(exec, "npm", ["view"], "/repo");
    assert.strictEqual(host.runBinaryExecFileSync("go", ["mod", "tidy"], "/repo"), true);
    assertCalledWith(execSync, "go", ["mod", "tidy"], "/repo");
    assert.strictEqual(await host.askBinaryHost("Continue?"), "yes");
  });

  test("normalizes missing output fields", async () => {
    const exec = mock.fn(async () => "{}");
    restoreHost = host.configureBinaryHost(exec, mock.fn(), mock.fn());

    const result = await host.binaryExecFile()?.("npm", [], { encoding: "utf8" });

    assert.deepStrictEqual(result, { stdout: "", stderr: "" });
    assertCalledWith(exec, "npm", [], "");
  });

  test("throws host errors from async and sync calls", async () => {
    const failure = '{"stdout":"","stderr":"","error":"command failed"}';
    restoreHost = host.configureBinaryHost(
      mock.fn(async () => failure),
      mock.fn(() => failure),
      mock.fn(),
    );

    await assertRejects(host.binaryExecFile()?.("npm", [], { encoding: "utf8" }), "command failed");
    assertThrows(() => host.runBinaryExecFileSync("go", [], ""), "command failed");
  });
});

describe("binary utilities", () => {
  afterEach(() => {
    runMock.mock.restore();
    runMock.mock.resetCalls();
    mock.restoreAll();
  });

  test("adds the script argument when argv is empty", () => {
    assert.deepStrictEqual(normalizeBinaryArgv([]), ["codependence", "codependence"]);
  });

  test("replaces a duplicated executable with the script name", () => {
    const argv = ["/usr/local/bin/codependence", "/usr/local/bin/codependence", "--help"];
    assert.deepStrictEqual(normalizeBinaryArgv(argv), [
      "/usr/local/bin/codependence",
      "codependence",
      "--help",
    ]);
  });

  test("adds the script argument before CLI options", () => {
    assert.deepStrictEqual(normalizeBinaryArgv(["/usr/local/bin/codependence", "--help"]), [
      "/usr/local/bin/codependence",
      "codependence",
      "--help",
    ]);
  });

  test("preserves Unix and Windows script paths", () => {
    assert.deepStrictEqual(normalizeBinaryArgv(["node", "dist/cli"]), ["node", "dist/cli"]);
    assert.deepStrictEqual(normalizeBinaryArgv(["node", "dist\\cli"]), ["node", "dist\\cli"]);
  });

  test("preserves script filenames with supported extensions", () => {
    assert.deepStrictEqual(normalizeBinaryArgv(["node", "cli.mjs"]), ["node", "cli.mjs"]);
  });

  test("runs the CLI with normalized arguments", async () => {
    runMock.mock.mockImplementation(async () => undefined);

    await binary.runBinary(["/usr/local/bin/codependence", "--help"], runMock);

    assertCalledWith(runMock, ["/usr/local/bin/codependence", "codependence", "--help"]);
  });

  test("logs CLI failures and exits with status 2", async () => {
    runMock.mock.mockImplementation(async () => {
      throw new Error("broken CLI");
    });
    const logError = mock.method(logger, "error", () => {});
    const exit = mock.method(process, "exit", (() => {}) as () => never);

    await binary.runBinary(["codependence"], runMock);

    assertCalledWith(logError, "broken CLI");
    assertCalledWith(exit, 2);
  });
});
