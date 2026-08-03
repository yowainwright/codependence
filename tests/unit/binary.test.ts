import { afterEach, describe, expect, jest, test } from "bun:test";
import * as binary from "../../src/bin";
import * as host from "../../src/bin/utils";
import { normalizeBinaryArgv } from "../../src/bin/utils";
import { logger } from "../../src/logger";
import * as program from "../../src/program";

describe("binary host", () => {
  let restoreHost: (() => void) | undefined;

  afterEach(() => {
    restoreHost?.();
    restoreHost = undefined;
  });

  test("returns no adapters before configuration", () => {
    expect(host.hasBinaryHost()).toBe(false);
    expect(host.binaryExecFile()).toBeUndefined();
    expect(host.runBinaryExecFileSync("go", ["mod", "tidy"], "/repo")).toBe(false);
    expect(host.askBinaryHost("Continue?")).toBeUndefined();
  });

  test("bridges async, sync, and prompt calls", async () => {
    const exec = jest.fn().mockResolvedValue('{"stdout":"1.2.3","stderr":"warning"}');
    const execSync = jest.fn().mockReturnValue('{"stdout":"done","stderr":""}');
    const question = jest.fn().mockResolvedValue("yes");
    restoreHost = host.configureBinaryHost(exec, execSync, question);

    const execFile = host.binaryExecFile();
    const result = await execFile?.("npm", ["view"], { cwd: "/repo", encoding: "utf8" });

    expect(host.hasBinaryHost()).toBe(true);
    expect(result).toEqual({ stdout: "1.2.3", stderr: "warning" });
    expect(exec).toHaveBeenCalledWith("npm", ["view"], "/repo");
    expect(host.runBinaryExecFileSync("go", ["mod", "tidy"], "/repo")).toBe(true);
    expect(execSync).toHaveBeenCalledWith("go", ["mod", "tidy"], "/repo");
    expect(await host.askBinaryHost("Continue?")).toBe("yes");
  });

  test("normalizes missing output fields", async () => {
    const exec = jest.fn().mockResolvedValue("{}");
    restoreHost = host.configureBinaryHost(exec, jest.fn(), jest.fn());

    const result = await host.binaryExecFile()?.("npm", [], { encoding: "utf8" });

    expect(result).toEqual({ stdout: "", stderr: "" });
    expect(exec).toHaveBeenCalledWith("npm", [], "");
  });

  test("throws host errors from async and sync calls", async () => {
    const failure = '{"stdout":"","stderr":"","error":"command failed"}';
    restoreHost = host.configureBinaryHost(
      jest.fn().mockResolvedValue(failure),
      jest.fn(() => failure),
      jest.fn(),
    );

    await expect(host.binaryExecFile()?.("npm", [], { encoding: "utf8" })).rejects.toThrow(
      "command failed",
    );
    expect(() => host.runBinaryExecFileSync("go", [], "")).toThrow("command failed");
  });
});

describe("binary utilities", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("adds the script argument when argv is empty", () => {
    expect(normalizeBinaryArgv([])).toEqual(["codependence", "codependence"]);
  });

  test("replaces a duplicated executable with the script name", () => {
    const argv = ["/usr/local/bin/codependence", "/usr/local/bin/codependence", "--help"];
    expect(normalizeBinaryArgv(argv)).toEqual([
      "/usr/local/bin/codependence",
      "codependence",
      "--help",
    ]);
  });

  test("adds the script argument before CLI options", () => {
    expect(normalizeBinaryArgv(["/usr/local/bin/codependence", "--help"])).toEqual([
      "/usr/local/bin/codependence",
      "codependence",
      "--help",
    ]);
  });

  test("preserves Unix and Windows script paths", () => {
    expect(normalizeBinaryArgv(["node", "dist/cli"])).toEqual(["node", "dist/cli"]);
    expect(normalizeBinaryArgv(["node", "dist\\cli"])).toEqual(["node", "dist\\cli"]);
  });

  test("preserves script filenames with supported extensions", () => {
    expect(normalizeBinaryArgv(["node", "cli.mjs"])).toEqual(["node", "cli.mjs"]);
  });

  test("runs the CLI with normalized arguments", async () => {
    const run = jest.spyOn(program, "run").mockResolvedValue(undefined);

    await binary.runBinary(["/usr/local/bin/codependence", "--help"]);

    expect(run).toHaveBeenCalledWith(["/usr/local/bin/codependence", "codependence", "--help"]);
  });

  test("logs CLI failures and exits with status 2", async () => {
    jest.spyOn(program, "run").mockRejectedValue(new Error("broken CLI"));
    const logError = jest.spyOn(logger, "error").mockImplementation(() => {});
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    await binary.runBinary(["codependence"]);

    expect(logError).toHaveBeenCalledWith("broken CLI");
    expect(exit).toHaveBeenCalledWith(2);
  });
});
