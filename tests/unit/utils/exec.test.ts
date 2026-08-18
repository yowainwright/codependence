import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertNthCalledWith } from "../../helpers/assertions";
import { exec } from "../../../src/utils/exec";

const makeExecFileFn = (result: { stdout: string; stderr: string }) =>
  mock.fn(async () => (result));

const makeSleepFn = () => mock.fn(async () => (undefined));

const rejectOnceThenResolve = <T>(error: unknown, result: T) => {
  const execFileFn = mock.fn();
  execFileFn.mock.mockImplementationOnce(async () => {
    throw error;
  });
  execFileFn.mock.mockImplementationOnce(async () => result, 1);
  return execFileFn;
};

describe("exec", () => {
  describe("success path", () => {
    it("returns stdout and stderr from execFileFn", async () => {
      const execFileFn = makeExecFileFn({ stdout: "output", stderr: "warn" });
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn });
      assert.deepStrictEqual((result), { stdout: "output", stderr: "warn" });
    });

    it("normalizes undefined stdout/stderr to empty string", async () => {
      const execFileFn = mock.fn(async () => ({ stdout: undefined, stderr: undefined }));
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn });
      assert.deepStrictEqual((result), { stdout: "", stderr: "" });
    });

    it("passes command, args, cwd, and encoding to execFileFn", async () => {
      const execFileFn = makeExecFileFn({ stdout: "", stderr: "" });
      const sleepFn = makeSleepFn();
      await exec("npm", ["install", "--save"], { cwd: "/tmp", execFileFn, sleepFn });
      assertCalledWith((execFileFn), "npm", ["install", "--save"], {
        cwd: "/tmp",
        encoding: "utf8",
      });
    });
  });

  describe("non-retryable errors", () => {
    it("throws immediately on ENOENT without sleeping", async () => {
      const error = Object.assign(new Error("not found"), { code: "ENOENT" });
      const execFileFn = mock.fn(async () => { throw error; });
      const sleepFn = makeSleepFn();
      await assert.rejects(exec("npm", ["view"], { execFileFn, sleepFn }), (error) => { assert.strictEqual(error, error); return true; });
      assert.strictEqual((sleepFn).mock.callCount(), 0);
    });

    it("throws immediately on generic error message without sleeping", async () => {
      const error = new Error("something went wrong");
      const execFileFn = mock.fn(async () => { throw error; });
      const sleepFn = makeSleepFn();
      await assert.rejects(exec("npm", ["view"], { execFileFn, sleepFn }), (error) => { assert.strictEqual(error, error); return true; });
      assert.strictEqual((sleepFn).mock.callCount(), 0);
    });

    it("throws immediately for non-object error (string)", async () => {
      const execFileFn = mock.fn(async () => { throw "string error"; });
      const sleepFn = makeSleepFn();
      await assert.rejects(exec("npm", ["view"], { execFileFn, sleepFn }), (error) => { assert.strictEqual(error, "string error"); return true; });
      assert.strictEqual((sleepFn).mock.callCount(), 0);
    });

    it("throws immediately for empty object error", async () => {
      const execFileFn = mock.fn(async () => { throw {}; });
      const sleepFn = makeSleepFn();
      await assert.rejects(exec("npm", ["view"], { execFileFn, sleepFn }), (error) => { assert.deepStrictEqual(error, {}); return true; });
      assert.strictEqual((sleepFn).mock.callCount(), 0);
    });
  });

  describe("retryable errors by code", () => {
    for (const code of ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]) {
      it(`retries on ${code} then succeeds`, async () => {
        const retryableError = Object.assign(new Error(code), { code });
        const execFileFn = rejectOnceThenResolve(retryableError, {
          stdout: "ok",
          stderr: "",
        });
        const sleepFn = makeSleepFn();
        const result = await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 });
        assert.deepStrictEqual((result), { stdout: "ok", stderr: "" });
        assert.strictEqual((execFileFn).mock.callCount(), 2);
        assert.strictEqual((sleepFn).mock.callCount(), 1);
      });
    }
  });

  describe("retryable errors by message", () => {
    it("retries on message containing 'timeout'", async () => {
      const execFileFn = rejectOnceThenResolve(new Error("Request timeout occurred"), {
        stdout: "ok",
        stderr: "",
      });
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 });
      assert.deepStrictEqual((result), { stdout: "ok", stderr: "" });
      assert.strictEqual((execFileFn).mock.callCount(), 2);
    });

    it("retries on message containing 'network' (case-insensitive)", async () => {
      const execFileFn = rejectOnceThenResolve(new Error("NETWORK FAILURE"), {
        stdout: "ok",
        stderr: "",
      });
      const sleepFn = makeSleepFn();
      const result = await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 });
      assert.deepStrictEqual((result), { stdout: "ok", stderr: "" });
      assert.strictEqual((execFileFn).mock.callCount(), 2);
    });
  });

  describe("retry exhaustion", () => {
    it("throws after maxRetries attempts", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = mock.fn(async () => { throw error; });
      const sleepFn = makeSleepFn();
      await assert.rejects(exec("npm", ["view"], { execFileFn, sleepFn, maxRetries: 3, retryDelay: 0 }), (error) => { assert.strictEqual(error, error); return true; });
      assert.strictEqual((execFileFn).mock.callCount(), 3);
      assert.strictEqual((sleepFn).mock.callCount(), 2);
    });
  });

  describe("backoff timing", () => {
    it("calls sleepFn with exponential backoff based on retryDelay", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = mock.fn(async () => { throw error; });
      const sleepFn = makeSleepFn();
      await assert.rejects(exec("npm", ["view"], { execFileFn, sleepFn, maxRetries: 3, retryDelay: 100 }), (error) => { assert.strictEqual(error, error); return true; });
      assertNthCalledWith((sleepFn), 1, 100);
      assertNthCalledWith((sleepFn), 2, 200);
    });

    it("respects custom retryDelay", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = rejectOnceThenResolve(error, { stdout: "", stderr: "" });
      const sleepFn = makeSleepFn();
      await exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 500 });
      assertCalledWith((sleepFn), 500);
    });
  });

  describe("default options", () => {
    it("uses the default sleep between retries", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = rejectOnceThenResolve(error, { stdout: "ok", stderr: "" });

      const result = await exec("npm", ["view"], { execFileFn, retryDelay: 0 });

      assert.deepStrictEqual((result), { stdout: "ok", stderr: "" });
      assert.strictEqual((execFileFn).mock.callCount(), 2);
    });

    it("defaults maxRetries to 3 (verified by exhaustion call count)", async () => {
      const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      const execFileFn = mock.fn(async () => { throw error; });
      const sleepFn = makeSleepFn();
      await assert.rejects(exec("npm", ["view"], { execFileFn, sleepFn, retryDelay: 0 }), (error) => { assert.strictEqual(error, error); return true; });
      assert.strictEqual((execFileFn).mock.callCount(), 3);
    });
  });
});
