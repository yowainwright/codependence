import { describe, it, expect, jest, beforeEach } from "bun:test";
import type { ExecResult, ExecFileFn, SleepFn } from "../../../src/utils/types";

type ExecFn = (
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    maxRetries?: number;
    retryDelay?: number;
    execFileFn?: ExecFileFn;
    sleepFn?: SleepFn;
  },
) => Promise<ExecResult>;

let exec: ExecFn;

beforeEach(async () => {
  ({ exec } = await import(import.meta.dir + "/../../../src/utils/exec.ts?" + Date.now()));
});

const makeExecFileFn = (result: { stdout: string; stderr: string }) =>
  jest.fn().mockResolvedValue(result);

const makeSleepFn = () => jest.fn().mockResolvedValue(undefined);

describe("exec", () => {
  describe("success path", () => {
    it("returns stdout and stderr from execFileFn", async () => {
      const execFileFn = makeExecFileFn({ stdout: "output", stderr: "warn" });
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn });
      expect(result).toEqual({ stdout: "output", stderr: "warn" });
    });

    it("normalizes undefined stdout/stderr to empty string", async () => {
      const execFileFn = jest.fn().mockResolvedValue({ stdout: undefined, stderr: undefined });
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn });
      expect(result).toEqual({ stdout: "", stderr: "" });
    });

    it("passes command, args, cwd, and encoding to execFileFn", async () => {
      const execFileFn = makeExecFileFn({ stdout: "", stderr: "" });
      const sleepFn = makeSleepFn();
      await exec("npm", ["install", "--save"], { cwd: "/tmp", execFileFn, sleepFn });
      expect(execFileFn).toHaveBeenCalledWith("npm", ["install", "--save"], {
        cwd: "/tmp",
        encoding: "utf8",
      });
    });
  });

  describe("non-retryable errors", () => {
    it("throws immediately on ENOENT without sleeping", async () => {
      const error = Object.assign(new Error("not found"), { code: "ENOENT" });
      const execFileFn = jest.fn().mockRejectedValue(error);
      const sleepFn = makeSleepFn();
      await expect(exec("npm", ["view"], { execFileFn, sleepFn })).rejects.toBe(error);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it("throws immediately on generic error message without sleeping", async () => {
      const error = new Error("something went wrong");
      const execFileFn = jest.fn().mockRejectedValue(error);
      const sleepFn = makeSleepFn();
      await expect(exec("npm", ["view"], { execFileFn, sleepFn })).rejects.toBe(error);
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it("throws immediately for non-object error (string)", async () => {
      const execFileFn = jest.fn().mockRejectedValue("string error");
      const sleepFn = makeSleepFn();
      await expect(exec("npm", ["view"], { execFileFn, sleepFn })).rejects.toBe("string error");
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it("throws immediately for empty object error", async () => {
      const execFileFn = jest.fn().mockRejectedValue({});
      const sleepFn = makeSleepFn();
      await expect(exec("npm", ["view"], { execFileFn, sleepFn })).rejects.toEqual({});
      expect(sleepFn).not.toHaveBeenCalled();
    });
  });

  describe("retryable errors by code", () => {
    for (const code of ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]) {
      it(`retries on ${code} then succeeds`, async () => {
        const retryableError = Object.assign(new Error(code), { code });
        const execFileFn = jest
          .fn()
          .mockRejectedValueOnce(retryableError)
          .mockResolvedValueOnce({ stdout: "ok", stderr: "" });
        const sleepFn = makeSleepFn();
        const result = await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 });
        expect(result).toEqual({ stdout: "ok", stderr: "" });
        expect(execFileFn).toHaveBeenCalledTimes(2);
        expect(sleepFn).toHaveBeenCalledTimes(1);
      });
    }
  });

  describe("retryable errors by message", () => {
    it("retries on message containing 'timeout'", async () => {
      const execFileFn = jest
        .fn()
        .mockRejectedValueOnce(new Error("Request timeout occurred"))
        .mockResolvedValueOnce({ stdout: "ok", stderr: "" });
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 });
      expect(result).toEqual({ stdout: "ok", stderr: "" });
      expect(execFileFn).toHaveBeenCalledTimes(2);
    });

    it("retries on message containing 'network' (case-insensitive)", async () => {
      const execFileFn = jest
        .fn()
        .mockRejectedValueOnce(new Error("NETWORK FAILURE"))
        .mockResolvedValueOnce({ stdout: "ok", stderr: "" });
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 });
      expect(result).toEqual({ stdout: "ok", stderr: "" });
      expect(execFileFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry exhaustion", () => {
    it("throws after maxRetries attempts", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = jest.fn().mockRejectedValue(error);
      const sleepFn = makeSleepFn();
      await expect(
        exec("npm", ["view"], { execFileFn, sleepFn, maxRetries: 3, retryDelay: 0 }),
      ).rejects.toBe(error);
      expect(execFileFn).toHaveBeenCalledTimes(3);
      expect(sleepFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("backoff timing", () => {
    it("calls sleepFn with exponential backoff based on retryDelay", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = jest.fn().mockRejectedValue(error);
      const sleepFn = makeSleepFn();
      await expect(
        exec("npm", ["view"], { execFileFn, sleepFn, maxRetries: 3, retryDelay: 100 }),
      ).rejects.toBe(error);
      expect(sleepFn).toHaveBeenNthCalledWith(1, 100);
      expect(sleepFn).toHaveBeenNthCalledWith(2, 200);
    });

    it("respects custom retryDelay", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ stdout: "", stderr: "" });
      const sleepFn = makeSleepFn();
      await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 500 });
      expect(sleepFn).toHaveBeenCalledWith(500);
    });
  });

  describe("default options", () => {
    it("defaults maxRetries to 3 (verified by exhaustion call count)", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = jest.fn().mockRejectedValue(error);
      const sleepFn = makeSleepFn();
      await expect(exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 })).rejects.toBe(
        error,
      );
      expect(execFileFn).toHaveBeenCalledTimes(3);
    });
  });
});
