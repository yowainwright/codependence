import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createAnsiPattern } from "../../../../src/dx/constants";
import { createSpinner, formatVersionTable, glimmer } from "../../../../src/dx/output";
import type { TableVersionDiff } from "../../../../src/dx/output";

const setInteractiveOutput = (interactive: boolean): void => {
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: interactive });
};

afterEach(() => {
  delete (process.stdout as { isTTY?: boolean }).isTTY;
  mock.timers.reset();
  mock.restoreAll();
});

describe("createSpinner", () => {
  it("should create a spinner with text", () => {
    const spinner = createSpinner("Loading...");
    assert.notStrictEqual(spinner, undefined);
    assert.strictEqual(spinner.text, "Loading...");
    assert.notStrictEqual(spinner.start, undefined);
    assert.notStrictEqual(spinner.stop, undefined);
    assert.notStrictEqual(spinner.succeed, undefined);
    assert.notStrictEqual(spinner.fail, undefined);
    assert.notStrictEqual(spinner.info, undefined);
    assert.notStrictEqual(spinner.warn, undefined);
  });

  it("should return spinner-like object from all methods", () => {
    const spinner = createSpinner("Test");

    const started = spinner.start();
    assert.notStrictEqual(started.stop, undefined);

    const stopped = started.stop();
    assert.notStrictEqual(stopped.succeed, undefined);

    const succeeded = stopped.succeed();
    assert.notStrictEqual(succeeded.fail, undefined);

    const failed = succeeded.fail();
    assert.notStrictEqual(failed.info, undefined);
  });

  it("should accept custom text in terminal methods", () => {
    const spinner = createSpinner("Loading...");

    const result1 = spinner.succeed("Done!");
    assert.notStrictEqual(result1.fail, undefined);

    const result2 = spinner.fail("Error!");
    assert.notStrictEqual(result2.info, undefined);

    const result3 = spinner.info("Info!");
    assert.notStrictEqual(result3.warn, undefined);

    const result4 = spinner.warn("Warning!");
    assert.notStrictEqual(result4.start, undefined);
  });

  it("updates spinner text", () => {
    const spinner = createSpinner("Loading...");

    spinner.text = "Still loading...";

    assert.strictEqual(spinner.text, "Still loading...");
  });

  it("renders frames while spinning", () => {
    setInteractiveOutput(true);
    mock.timers.enable({ apis: ["setInterval"] });
    const writeSpy = mock.method(process.stdout, "write", () => true);
    const spinner = createSpinner("Loading...");

    const started = spinner.start();
    mock.timers.tick(80);
    started.stop();

    const output = writeSpy.mock.calls.flatMap((call) => call.arguments).join("");
    assert.ok(output.includes("Loading..."));
  });

  it("renders the first frame immediately", () => {
    setInteractiveOutput(true);
    mock.timers.enable({ apis: ["setInterval"] });
    const writeSpy = mock.method(process.stdout, "write", () => true);

    createSpinner("Loading...").start();

    const output = writeSpy.mock.calls.flatMap((call) => call.arguments).join("");
    assert.ok(output.includes("Loading..."));
  });

  it("keeps frames on one line", () => {
    setInteractiveOutput(true);
    mock.timers.enable({ apis: ["setInterval"] });
    const writeSpy = mock.method(process.stdout, "write", () => true);
    const spinner = createSpinner("Loading...\n").start();

    mock.timers.tick(240);
    spinner.stop();

    const output = writeSpy.mock.calls.flatMap((call) => call.arguments).join("");
    assert.ok(!output.includes("\n"));
  });

  it("does not animate non-interactive output", () => {
    setInteractiveOutput(false);
    mock.timers.enable({ apis: ["setInterval"] });
    const writeSpy = mock.method(process.stdout, "write", () => true);
    const spinner = createSpinner("Loading...").start();

    mock.timers.tick(80);
    spinner.stop();

    assert.strictEqual(writeSpy.mock.callCount(), 0);
  });

  it("writes non-interactive results without terminal control codes", () => {
    setInteractiveOutput(false);
    const writeSpy = mock.method(process.stdout, "write", () => true);

    createSpinner("\x1B[31mDone\x1B[0m").succeed();

    const output = writeSpy.mock.calls.flatMap((call) => call.arguments).join("");
    assert.strictEqual(output, "\u2714 Done\n");
  });

  it("keeps spinner methods stable when start is called twice", () => {
    setInteractiveOutput(true);
    mock.timers.enable({ apis: ["setInterval"] });
    const spinner = createSpinner("Loading...");

    const started = spinner.start();
    const startedAgain = started.start();
    const stopped = startedAgain.stop();

    assert.notStrictEqual(stopped.succeed, undefined);
  });

  it("allows stop before start", () => {
    const spinner = createSpinner("Loading...");

    const stopped = spinner.stop();

    assert.notStrictEqual(stopped.start, undefined);
  });
});

describe("glimmer", () => {
  it("keeps the original text while adding ANSI color", () => {
    const result = glimmer("codependence", { frameIndex: 3 });

    assert.strictEqual(result.replace(createAnsiPattern(), ""), "codependence");
    assert.ok(result.includes("\x1b[38;2;"));
  });

  it("loops after the final character", () => {
    const firstFrame = glimmer("codependence", { frameIndex: 0 });
    const loopedFrame = glimmer("codependence", { frameIndex: "codependence".length });

    assert.strictEqual(loopedFrame, firstFrame);
  });
});

describe("formatVersionTable", () => {
  it("colors prerelease transitions by the release size", () => {
    const diffs: TableVersionDiff[] = [
      { package: "premajor", current: "1.0.0-alpha.1", latest: "1.0.0", isPinned: false },
      { package: "preminor", current: "1.2.0-alpha.1", latest: "1.2.0", isPinned: false },
      { package: "prepatch", current: "1.2.3-alpha.1", latest: "1.2.3", isPinned: false },
      { package: "prerelease", current: "1.2.3-alpha.1", latest: "1.2.3-beta.1", isPinned: false },
    ];

    const result = formatVersionTable(diffs, "check");

    assert.ok(result.includes("premajor"));
    assert.ok(result.includes("preminor"));
    assert.ok(result.includes("prepatch"));
    assert.ok(result.includes("prerelease"));
    assert.ok(result.includes("1.2.3-beta.1"));
  });

  it("colors release-to-prerelease transitions as release diffs", () => {
    const diffs: TableVersionDiff[] = [
      { package: "rollback", current: "1.0.0", latest: "1.0.0-beta.1", isPinned: false },
    ];

    const result = formatVersionTable(diffs, "check");

    assert.ok(result.includes("rollback"));
    assert.ok(result.includes("1.0.0-beta.1"));
  });
});
