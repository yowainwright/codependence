import { describe, it, expect } from "bun:test";
import { createSpinner } from "../../../src/utils/spinner";

describe("createSpinner", () => {
  it("should create a spinner with text", () => {
    const spinner = createSpinner("Loading...");
    expect(spinner).toBeDefined();
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
});
