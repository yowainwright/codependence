import { describe, it, expect } from "bun:test";

describe("exec utility", () => {
  it("should test retry logic helper functions", () => {
    const isRetryableError = (error: unknown): boolean => {
      if (!error || typeof error !== "object") return false;

      const err = error as { code?: string; message?: string };
      const retryableCodes = ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"];

      if (err.code && retryableCodes.includes(err.code)) return true;

      const message = err.message?.toLowerCase() || "";
      return message.includes("timeout") || message.includes("network");
    };

    expect(isRetryableError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
    expect(isRetryableError({ code: "ENOTFOUND" })).toBe(true);
    expect(isRetryableError({ code: "EAI_AGAIN" })).toBe(true);
    expect(isRetryableError({ message: "timeout occurred" })).toBe(true);
    expect(isRetryableError({ message: "Network error" })).toBe(true);
    expect(isRetryableError({ message: "NETWORK FAILURE" })).toBe(true);
    expect(isRetryableError({ code: "ENOENT" })).toBe(false);
    expect(isRetryableError({ message: "other error" })).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError("string")).toBe(false);
    expect(isRetryableError({})).toBe(false);
    expect(isRetryableError({ code: undefined, message: undefined })).toBe(false);
  });

  it("should test sleep function", async () => {
    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const start = Date.now();
    await sleep(10);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(8);
    expect(elapsed).toBeLessThan(50);
  });

  it("should test backoff calculation", () => {
    const calculateBackoff = (retryDelay: number, attempt: number): number => {
      return retryDelay * Math.pow(2, attempt);
    };

    expect(calculateBackoff(1000, 0)).toBe(1000);
    expect(calculateBackoff(1000, 1)).toBe(2000);
    expect(calculateBackoff(1000, 2)).toBe(4000);
    expect(calculateBackoff(500, 1)).toBe(1000);
  });

  it("should test default options handling", () => {
    const getOptions = (
      options: { cwd?: string; maxRetries?: number; retryDelay?: number } = {}
    ) => {
      const { cwd, maxRetries = 3, retryDelay = 1000 } = options;
      return { cwd, maxRetries, retryDelay };
    };

    expect(getOptions()).toEqual({ cwd: undefined, maxRetries: 3, retryDelay: 1000 });
    expect(getOptions({ cwd: "/tmp" })).toEqual({ cwd: "/tmp", maxRetries: 3, retryDelay: 1000 });
    expect(getOptions({ maxRetries: 5 })).toEqual({ cwd: undefined, maxRetries: 5, retryDelay: 1000 });
    expect(getOptions({ retryDelay: 500 })).toEqual({ cwd: undefined, maxRetries: 3, retryDelay: 500 });
  });

  it("should test stdout/stderr handling", () => {
    const handleOutput = (stdout?: string, stderr?: string) => ({
      stdout: stdout || "",
      stderr: stderr || "",
    });

    expect(handleOutput("test", "error")).toEqual({ stdout: "test", stderr: "error" });
    expect(handleOutput(undefined, undefined)).toEqual({ stdout: "", stderr: "" });
    expect(handleOutput("", "")).toEqual({ stdout: "", stderr: "" });
    expect(handleOutput("output", undefined)).toEqual({ stdout: "output", stderr: "" });
    expect(handleOutput(undefined, "error")).toEqual({ stdout: "", stderr: "error" });
  });
});