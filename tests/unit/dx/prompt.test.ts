import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ANSI } from "../../../src/dx/constants";

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SIGNAL_TIMEOUT_MS = 5000;
const READY_MARKER = "PROMPT_READY";
const SIGNAL_CASES = [
  { mode: "radio", signal: "SIGINT" },
  { mode: "radio", signal: "SIGTERM" },
  { mode: "select", signal: "SIGINT" },
  { mode: "select", signal: "SIGTERM" },
] as const;

type SignalResult = { code: number | null; signal: NodeJS.Signals | null; output: string };

const spawnPrompt = (mode: "radio" | "select"): ChildProcessWithoutNullStreams => {
  const code = `
    import { ${mode} } from "./src/dx/prompt.ts";
    Object.defineProperty(process.stdin, "isTTY", { value: true });
    Object.defineProperty(process.stdout, "isTTY", { value: true });
    process.stdin.setRawMode = (enabled) => {
      process.stdout.write("RAW_MODE=" + enabled + "\\n");
      return process.stdin;
    };
    const pending = ${mode}({ message: "Choose", choices: [{ name: "Alpha", value: "alpha" }] });
    process.stdout.write("${READY_MARKER}");
    await pending;
    process.stdout.write("PROMPT_RESOLVED");
  `;
  const args = ["--import", "./scripts/run/index.ts", "--input-type=module", "--eval", code];
  return spawn(process.execPath, args, { cwd: PROJECT_ROOT });
};

const terminatePrompt = (
  child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals,
): Promise<SignalResult> =>
  new Promise((resolve, reject) => {
    let output = "";
    let signalSent = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timed out waiting for prompt termination: ${signal}`));
    }, SIGNAL_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (signalSent) return;
      if (!output.includes(READY_MARKER)) return;
      signalSent = true;
      child.kill(signal);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, receivedSignal) => {
      clearTimeout(timeout);
      resolve({ code, signal: receivedSignal, output });
    });
  });

describe("prompt termination signals", () => {
  SIGNAL_CASES.forEach(({ mode, signal }) => {
    test(`${mode} restores terminal state before terminating on ${signal}`, async () => {
      const child = spawnPrompt(mode);
      const result = await terminatePrompt(child, signal);

      assert.strictEqual(result.code, null, result.output);
      assert.strictEqual(result.signal, signal, result.output);
      assert.ok(result.output.includes("RAW_MODE=true"), result.output);
      assert.ok(result.output.includes("RAW_MODE=false"), result.output);
      assert.ok(result.output.includes(ANSI.HIDE_CURSOR), result.output);
      assert.ok(result.output.includes(ANSI.SHOW_CURSOR), result.output);
      assert.ok(!result.output.includes("PROMPT_RESOLVED"), result.output);
    });
  });
});
