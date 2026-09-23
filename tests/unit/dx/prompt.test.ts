import { assertTextIncludes } from "../../helpers/assertions";
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ANSI } from "../../../src/dx/constants";
import { Prompt, radio } from "../../../src/dx/prompt";

const DISABLED_CHOICES = [
  { name: "Unavailable", value: "unavailable", disabled: true, checked: true },
  { name: "Pinned", value: "pinned", disabled: "pinned" },
  { name: "Disabled without a label", value: "unlabeled", disabled: "" },
];

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

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("disabled radio choices", () => {
  test("rejects an all-disabled list before opening the terminal", async () => {
    await assert.rejects(
      radio({ message: "Choose", choices: DISABLED_CHOICES }),
      /Radio prompt requires at least one enabled choice/,
    );
  });

  [false, true].forEach((interactive) => {
    test(`rejects all-disabled choices before requesting input (interactive=${interactive})`, async () => {
      const radioPrompt = mock.fn(() => Promise.resolve("unavailable"));
      const prompt = new Prompt({ interactive, radioPrompt });
      const question = mock.method(prompt["rl"]!, "question", () => {
        throw new Error("Should not request an impossible choice");
      });
      try {
        await assert.rejects(
          prompt.radio("Choose", DISABLED_CHOICES),
          /Radio prompt requires at least one enabled choice/,
        );
        assert.strictEqual(question.mock.callCount(), 0);
        assert.strictEqual(radioPrompt.mock.callCount(), 0);
      } finally {
        question.mock.restore();
        prompt.close();
      }
    });
  });

  test("allows an empty checkbox selection when every choice is disabled", async () => {
    const prompt = new Prompt({ interactive: false });
    const question = mock.method(prompt["rl"]!, "question", (_, answer) => answer(""));
    try {
      assert.deepStrictEqual(await prompt.select("Choose", DISABLED_CHOICES), []);
    } finally {
      question.mock.restore();
      prompt.close();
    }
  });

  test("allows explicitly enabled radio choices", async () => {
    const radioPrompt = mock.fn(() => Promise.resolve("enabled"));
    const prompt = new Prompt({ interactive: true, radioPrompt });
    const choices = DISABLED_CHOICES.concat({ name: "Enabled", value: "enabled", disabled: false });
    try {
      assert.strictEqual(await prompt.radio("Choose", choices), "enabled");
      assert.strictEqual(radioPrompt.mock.callCount(), 1);
    } finally {
      prompt.close();
    }
  });
});

describe("prompt termination signals", () => {
  SIGNAL_CASES.forEach(({ mode, signal }) => {
    test(`${mode} restores terminal state before terminating on ${signal}`, async () => {
      const child = spawnPrompt(mode);
      const result = await terminatePrompt(child, signal);

      assert.strictEqual(result.code, null, result.output);
      assert.strictEqual(result.signal, signal, result.output);
      assert.match(result.output, /RAW_MODE=true/, result.output);
      assert.match(result.output, /RAW_MODE=false/, result.output);
      assertTextIncludes(result.output, ANSI.HIDE_CURSOR, result.output);
      assertTextIncludes(result.output, ANSI.SHOW_CURSOR, result.output);
      assert.doesNotMatch(result.output, /PROMPT_RESOLVED/, result.output);
    });
  });
});
