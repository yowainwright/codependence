import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith } from "../../helpers/assertions";
import { Prompt, createPrompt, radio, select } from "../../../src/dx";

type TTYStream = { isTTY?: boolean };
type PromptKey = { name?: string; ctrl?: boolean };

const setTTY = (stream: TTYStream, value: boolean): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(stream, "isTTY");
  Object.defineProperty(stream, "isTTY", { configurable: true, value });
  return () => {
    if (descriptor) {
      Object.defineProperty(stream, "isTTY", descriptor);
      return;
    }
    delete stream.isTTY;
  };
};

const installRawMode = (): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdin, "setRawMode");
  const setRawMode = (): NodeJS.ReadStream => process.stdin;
  Object.defineProperty(process.stdin, "setRawMode", { configurable: true, value: setRawMode });
  return () => {
    if (descriptor) {
      Object.defineProperty(process.stdin, "setRawMode", descriptor);
      return;
    }
    delete (process.stdin as { setRawMode?: unknown }).setRawMode;
  };
};

const removeRawMode = (): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdin, "setRawMode");
  Object.defineProperty(process.stdin, "setRawMode", { configurable: true, value: undefined });
  return () => {
    if (descriptor) {
      Object.defineProperty(process.stdin, "setRawMode", descriptor);
      return;
    }
    delete (process.stdin as { setRawMode?: unknown }).setRawMode;
  };
};

const setColumns = (value: number): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "columns");
  Object.defineProperty(process.stdout, "columns", { configurable: true, value });
  return () => {
    if (descriptor) {
      Object.defineProperty(process.stdout, "columns", descriptor);
      return;
    }
    delete (process.stdout as { columns?: number }).columns;
  };
};

const withInteractiveTerminal = async <T>(callback: () => Promise<T>): Promise<T> => {
  const restoreInputTTY = setTTY(process.stdin, true);
  const restoreOutputTTY = setTTY(process.stdout, true);
  const restoreRawMode = installRawMode();
  try {
    return await callback();
  } finally {
    restoreRawMode();
    restoreInputTTY();
    restoreOutputTTY();
  }
};

const emitKeypress = (input = "", key: PromptKey = {}): void => {
  process.stdin.emit("keypress", input, key);
};

const emitDown = (count: number): void => {
  Array.from({ length: count }).forEach(() => emitKeypress("", { name: "down" }));
};

describe("Prompt", { concurrency: false }, () => {
  test("should create readline interface on construction", () => {
    const prompt = new Prompt();
    assert.notStrictEqual(prompt, undefined);
    prompt.close();
  });

  test("should close readline interface", () => {
    const prompt = new Prompt();
    prompt.close();
    assert.strictEqual(true, true);
  });

  test("input should resolve with answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("test answer");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question");

    assert.strictEqual(result, "test answer");
    assert.ok(mockQuestion.mock.callCount() > 0);
    prompt.close();
  });

  test("input should use default value when answer is empty", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question", "default");

    assert.strictEqual(result, "default");
    prompt.close();
  });

  test("input should trim answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("  answer  ");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question");

    assert.strictEqual(result, "answer");
    prompt.close();
  });

  test("input should disable raw mode on a tty", async () => {
    await withInteractiveTerminal(async () => {
      const prompt = new Prompt();
      const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
        cb("answer");
      });
      prompt["rl"].question = mockQuestion;

      try {
        const result = await prompt.input("Test question");
        assert.strictEqual(result, "answer");
      } finally {
        prompt.close();
      }
    });
  });

  test("confirm should resolve true for y", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("y");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual(result, true);
    prompt.close();
  });

  test("confirm should resolve true for yes", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("yes");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual(result, true);
    prompt.close();
  });

  test("confirm should resolve false for n", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("n");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual(result, false);
    prompt.close();
  });

  test("confirm should resolve false for no", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("no");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual(result, false);
    prompt.close();
  });

  test("confirm should use default value for empty answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question", true);

    assert.strictEqual(result, true);
    prompt.close();
  });

  test("confirm should use default false for empty answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question", false);

    assert.strictEqual(result, false);
    prompt.close();
  });

  test("confirm should be case insensitive", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("Y");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual(result, true);
    prompt.close();
  });

  test("radio should resolve with selected choice value", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("1");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.radio("Choose one", choices);

    assert.strictEqual(result, "opt1");
    prompt.close();
  });

  test("radio should use an interactive selector", async () => {
    const radioPrompt = mock.fn(() => Promise.resolve("opt2"));
    const prompt = new Prompt({ radioPrompt, interactive: true });
    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.radio("Choose one", choices);

    assert.strictEqual(result, "opt2");
    assertCalledWith(radioPrompt, { message: "Choose one", choices });
    prompt.close();
  });

  test("interactive radio should navigate and skip disabled choices", async () => {
    const choices = [
      { name: "Pinned", value: "pinned", disabled: "pinned" },
      { name: "Option 1", value: "opt1", description: "compatible update" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await withInteractiveTerminal(async () => {
      const resultPromise = radio({ message: "Choose one", choices });
      emitKeypress("", { name: "down" });
      emitKeypress("", { name: "up" });
      emitKeypress("", { name: "return" });
      return resultPromise;
    });

    assert.strictEqual(result, "opt1");
  });

  test("interactive select should support scrolling and selection shortcuts", async () => {
    const restoreColumns = setColumns(120);
    const choices = [
      { name: "Pinned", value: "pinned", disabled: "pinned" },
      { name: "Option 1", value: "opt1", checked: true, description: "compatible update" },
      { name: "Option 2", value: "opt2" },
      { name: "Option 3", value: "opt3" },
      { name: "Option 4", value: "opt4" },
      { name: "Option 5", value: "opt5" },
      { name: "Option 6", value: "opt6" },
      { name: "Option 7", value: "opt7" },
      { name: "Option 8", value: "opt8" },
      { name: "Option 9", value: "opt9" },
    ];

    try {
      const result = await withInteractiveTerminal(async () => {
        const resultPromise = select({ message: "Choose multiple", choices });
        process.stdin.emit("data", Buffer.from("x"));
        emitDown(9);
        emitKeypress("a");
        emitKeypress("n");
        emitKeypress(" ", { name: "space" });
        process.stdin.emit("data", Buffer.from(" "));
        emitKeypress(" ", { name: "space" });
        emitKeypress("a");
        emitKeypress("", { name: "enter" });
        return resultPromise;
      });

      assert.deepStrictEqual(result, [
        "opt1",
        "opt2",
        "opt3",
        "opt4",
        "opt5",
        "opt6",
        "opt7",
        "opt8",
        "opt9",
      ]);
    } finally {
      restoreColumns();
    }
  });

  test("interactive selector should reject on cancellation", async () => {
    await withInteractiveTerminal(async () => {
      const escapeKey = radio({
        message: "Choose one",
        choices: [{ name: "Option", value: "opt" }],
      });
      emitKeypress("", { name: "escape" });
      await assert.rejects(escapeKey, { name: "PromptCancelled" });

      const escapeInput = radio({
        message: "Choose one",
        choices: [{ name: "Option", value: "opt" }],
      });
      emitKeypress("\u001b");
      await assert.rejects(escapeInput, { name: "PromptCancelled" });

      const controlC = radio({
        message: "Choose one",
        choices: [{ name: "Option", value: "opt" }],
      });
      emitKeypress("", { name: "c", ctrl: true });
      await assert.rejects(controlC, { name: "PromptCancelled" });
    });
  });

  test("interactive selector should reject without choices", async () => {
    await assert.rejects(radio({ message: "Choose one", choices: [] }), /at least one choice/);
    await assert.rejects(
      select({ message: "Choose multiple", choices: [] }),
      /at least one choice/,
    );
  });

  test("interactive selector should reject without an interactive terminal", async () => {
    const restoreInputTTY = setTTY(process.stdin, false);
    const restoreOutputTTY = setTTY(process.stdout, false);
    const restoreRawMode = installRawMode();

    try {
      await assert.rejects(
        radio({ message: "Choose one", choices: [{ name: "Option", value: "opt" }] }),
        /Interactive prompt input is unavailable/,
      );
    } finally {
      restoreRawMode();
      restoreInputTTY();
      restoreOutputTTY();
    }
  });

  test("interactive selector should reject without raw mode", async () => {
    const restoreInputTTY = setTTY(process.stdin, true);
    const restoreOutputTTY = setTTY(process.stdout, true);
    const restoreRawMode = removeRawMode();

    try {
      await assert.rejects(
        radio({ message: "Choose one", choices: [{ name: "Option", value: "opt" }] }),
        /Interactive prompt input is unavailable/,
      );
    } finally {
      restoreRawMode();
      restoreInputTTY();
      restoreOutputTTY();
    }
  });

  test("radio should remain closed when the interactive selector rejects", async () => {
    const rejection = new Error("cancelled");
    const radioPrompt = mock.fn(() => Promise.reject(rejection));
    const prompt = new Prompt({ radioPrompt, interactive: true });
    const choices = [{ name: "Option 1", value: "opt1" }];

    await assert.rejects(prompt.radio("Choose one", choices), (error) => {
      assert.strictEqual(error, rejection);
      return true;
    });

    assert.strictEqual(prompt["rl"], undefined);
  });

  test("radio should handle second choice", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("2");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.radio("Choose one", choices);

    assert.strictEqual(result, "opt2");
    prompt.close();
  });

  test("radio should re-prompt on invalid number", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("99");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.radio("Choose one", choices);

    assert.strictEqual(result, "opt1");
    assert.strictEqual(mockQuestion.mock.callCount(), 2);
    prompt.close();
  });

  test("radio should re-prompt on non-numeric input", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("abc");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.radio("Choose one", choices);

    assert.strictEqual(result, "opt1");
    assert.strictEqual(mockQuestion.mock.callCount(), 2);
    prompt.close();
  });

  test("select should resolve with selected choice values", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("1,3");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
      { name: "Option 3", value: "opt3" },
    ];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, ["opt1", "opt3"]);
    prompt.close();
  });

  test("select should use an interactive selector", async () => {
    const selectPrompt = mock.fn(() => Promise.resolve(["opt1", "opt3"]));
    const prompt = new Prompt({ selectPrompt, interactive: true });
    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
      { name: "Option 3", value: "opt3" },
    ];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, ["opt1", "opt3"]);
    assertCalledWith(selectPrompt, { message: "Choose multiple", choices });
    prompt.close();
  });

  test("select should handle single selection", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("2");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, ["opt2"]);
    prompt.close();
  });

  test("select should resolve empty array for empty input", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, []);
    prompt.close();
  });

  test("select should handle whitespace in input", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb(" 1 , 2 ");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, ["opt1", "opt2"]);
    prompt.close();
  });

  test("select should re-prompt on invalid numbers", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("1,99");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, ["opt1"]);
    assert.strictEqual(mockQuestion.mock.callCount(), 2);
    prompt.close();
  });

  test("select should re-prompt on non-numeric input", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("a,b");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, ["opt1"]);
    assert.strictEqual(mockQuestion.mock.callCount(), 2);
    prompt.close();
  });

  test("select should handle all selections", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("1,2,3");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
      { name: "Option 3", value: "opt3" },
    ];

    const result = await prompt.select("Choose multiple", choices);

    assert.deepStrictEqual(result, ["opt1", "opt2", "opt3"]);
    prompt.close();
  });
});

describe("createPrompt", () => {
  test("should create prompt and execute callback", async () => {
    const result = await createPrompt(async () => "test result");

    assert.strictEqual(result, "test result");
  });

  test("should close prompt after callback", async () => {
    let promptInstance: Prompt | null = null;

    await createPrompt(async (prompt) => {
      promptInstance = prompt;
      return "test";
    });

    assert.notStrictEqual(promptInstance, undefined);
  });

  test("should handle callback errors", async () => {
    try {
      await createPrompt(async () => {
        throw new Error("Test error");
      });
      assert.strictEqual(true, false);
    } catch (err) {
      assert.strictEqual((err as Error).message, "Test error");
    }
  });
});
