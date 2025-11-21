import { describe, it, expect } from "bun:test";
import { exec } from "../../src/utils/exec";

describe("exec", () => {
  it("should execute a command and return stdout", async () => {
    const result = await exec("echo", ["hello"]);
    expect(result.stdout).toBe("hello\n");
    expect(result.stderr).toBe("");
  });

  it("should execute npm --version", async () => {
    const result = await exec("npm", ["--version"]);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("should handle command with multiple args", async () => {
    const result = await exec("node", ["--version"]);
    expect(result.stdout).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("should support cwd option", async () => {
    const result = await exec("pwd", [], { cwd: "/tmp" });
    const output = result.stdout.trim();
    expect(output === "/tmp" || output === "/private/tmp").toBe(true);
  });

  it("should throw on invalid command", async () => {
    expect(async () => {
      await exec("nonexistentcommand12345", []);
    }).toThrow();
  });
});
