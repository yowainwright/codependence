import { afterEach, describe, it, expect, jest } from "bun:test";
import { createSpinner } from "../../../src/utils/spinner";

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("createSpinner", () => {
  it("should create a spinner with text", () => {
    const spinner = createSpinner("Loading...");
    expect(spinner).toBeDefined();
    expect(spinner.text).toBe("Loading...");
    expect(spinner.start).toBeDefined();
    expect(spinner.stop).toBeDefined();
    expect(spinner.succeed).toBeDefined();
    expect(spinner.fail).toBeDefined();
    expect(spinner.info).toBeDefined();
    expect(spinner.warn).toBeDefined();
  });

  it("should return spinner-like object from all methods", () => {
    const spinner = createSpinner("Test");

    const started = spinner.start();
    expect(started.stop).toBeDefined();

    const stopped = started.stop();
    expect(stopped.succeed).toBeDefined();

    const succeeded = stopped.succeed();
    expect(succeeded.fail).toBeDefined();

    const failed = succeeded.fail();
    expect(failed.info).toBeDefined();
  });

  it("should accept custom text in terminal methods", () => {
    const spinner = createSpinner("Loading...");

    const result1 = spinner.succeed("Done!");
    expect(result1.fail).toBeDefined();

    const result2 = spinner.fail("Error!");
    expect(result2.info).toBeDefined();

    const result3 = spinner.info("Info!");
    expect(result3.warn).toBeDefined();

    const result4 = spinner.warn("Warning!");
    expect(result4.start).toBeDefined();
  });

  it("updates spinner text", () => {
    const spinner = createSpinner("Loading...");

    spinner.text = "Still loading...";

    expect(spinner.text).toBe("Still loading...");
  });

  it("renders frames while spinning", () => {
    jest.useFakeTimers();
    const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    const spinner = createSpinner("Loading...");

    const started = spinner.start();
    jest.advanceTimersByTime(80);
    started.stop();

    const output = writeSpy.mock.calls.flat().join("");
    expect(output).toContain("Loading...");
  });

  it("keeps frames on one line", () => {
    jest.useFakeTimers();
    const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    const spinner = createSpinner("Loading...\n").start();

    jest.advanceTimersByTime(240);
    spinner.stop();

    const output = writeSpy.mock.calls.flat().join("");
    expect(output).not.toContain("\n");
  });

  it("keeps spinner methods stable when start is called twice", () => {
    const spinner = createSpinner("Loading...");

    const started = spinner.start();
    const startedAgain = started.start();
    const stopped = startedAgain.stop();

    expect(stopped.succeed).toBeDefined();
  });

  it("allows stop before start", () => {
    const spinner = createSpinner("Loading...");

    const stopped = spinner.stop();

    expect(stopped.start).toBeDefined();
  });
});
