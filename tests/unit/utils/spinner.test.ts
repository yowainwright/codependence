import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createSpinner } from "../../../src/utils/spinner";

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

describe("createSpinner", () => {
  it("should create a spinner with text", () => {
    const spinner = createSpinner("Loading...");
    assert.notStrictEqual((spinner), undefined);
    assert.strictEqual((spinner.text), "Loading...");
    assert.notStrictEqual((spinner.start), undefined);
    assert.notStrictEqual((spinner.stop), undefined);
    assert.notStrictEqual((spinner.succeed), undefined);
    assert.notStrictEqual((spinner.fail), undefined);
    assert.notStrictEqual((spinner.info), undefined);
    assert.notStrictEqual((spinner.warn), undefined);
  });

  it("should return spinner-like object from all methods", () => {
    const spinner = createSpinner("Test");

    const started = spinner.start();
    assert.notStrictEqual((started.stop), undefined);

    const stopped = started.stop();
    assert.notStrictEqual((stopped.succeed), undefined);

    const succeeded = stopped.succeed();
    assert.notStrictEqual((succeeded.fail), undefined);

    const failed = succeeded.fail();
    assert.notStrictEqual((failed.info), undefined);
  });

  it("should accept custom text in terminal methods", () => {
    const spinner = createSpinner("Loading...");

    const result1 = spinner.succeed("Done!");
    assert.notStrictEqual((result1.fail), undefined);

    const result2 = spinner.fail("Error!");
    assert.notStrictEqual((result2.info), undefined);

    const result3 = spinner.info("Info!");
    assert.notStrictEqual((result3.warn), undefined);

    const result4 = spinner.warn("Warning!");
    assert.notStrictEqual((result4.start), undefined);
  });

  it("updates spinner text", () => {
    const spinner = createSpinner("Loading...");

    spinner.text = "Still loading...";

    assert.strictEqual((spinner.text), "Still loading...");
  });

  it("renders frames while spinning", () => {
    mock.timers.enable({ apis: ["setInterval"] });
    const writeSpy = mock.method(process.stdout, "write", () => true);
    const spinner = createSpinner("Loading...");

    const started = spinner.start();
    mock.timers.tick(80);
    started.stop();

    const output = writeSpy.mock.calls.flatMap((call) => call.arguments).join("");
    assert.ok((output).includes("Loading..."));
  });

  it("keeps frames on one line", () => {
    mock.timers.enable({ apis: ["setInterval"] });
    const writeSpy = mock.method(process.stdout, "write", () => true);
    const spinner = createSpinner("Loading...\n").start();

    mock.timers.tick(240);
    spinner.stop();

    const output = writeSpy.mock.calls.flatMap((call) => call.arguments).join("");
    assert.ok(!(output).includes("\n"));
  });

  it("keeps spinner methods stable when start is called twice", () => {
    const spinner = createSpinner("Loading...");

    const started = spinner.start();
    const startedAgain = started.start();
    const stopped = startedAgain.stop();

    assert.notStrictEqual((stopped.succeed), undefined);
  });

  it("allows stop before start", () => {
    const spinner = createSpinner("Loading...");

    const stopped = spinner.stop();

    assert.notStrictEqual((stopped.start), undefined);
  });
});
