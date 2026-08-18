import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith } from "../../helpers/assertions";
import { Prompt, createPrompt } from "../../../src/dx";

describe("Prompt", () => {
  test("should create readline interface on construction", () => {
    const prompt = new Prompt();
    assert.notStrictEqual((prompt), undefined);
    prompt.close();
  });

  test("should close readline interface", () => {
    const prompt = new Prompt();
    prompt.close();
    assert.strictEqual((true), true);
  });

  test("input should resolve with answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("test answer");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question");

    assert.strictEqual((result), "test answer");
    assert.ok((mockQuestion).mock.callCount() > 0);
    prompt.close();
  });

  test("input should use default value when answer is empty", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question", "default");

    assert.strictEqual((result), "default");
    prompt.close();
  });

  test("input should trim answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("  answer  ");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question");

    assert.strictEqual((result), "answer");
    prompt.close();
  });

  test("confirm should resolve true for y", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("y");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual((result), true);
    prompt.close();
  });

  test("confirm should resolve true for yes", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("yes");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual((result), true);
    prompt.close();
  });

  test("confirm should resolve false for n", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("n");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual((result), false);
    prompt.close();
  });

  test("confirm should resolve false for no", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("no");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual((result), false);
    prompt.close();
  });

  test("confirm should use default value for empty answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question", true);

    assert.strictEqual((result), true);
    prompt.close();
  });

  test("confirm should use default false for empty answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question", false);

    assert.strictEqual((result), false);
    prompt.close();
  });

  test("confirm should be case insensitive", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock.fn((q: string, cb: (answer: string) => void) => {
      cb("Y");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    assert.strictEqual((result), true);
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

    assert.strictEqual((result), "opt1");
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

    assert.strictEqual((result), "opt2");
    assertCalledWith((radioPrompt), { message: "Choose one", choices });
    prompt.close();
  });

  test("radio should remain closed when the interactive selector rejects", async () => {
    const rejection = new Error("cancelled");
    const radioPrompt = mock.fn(() => Promise.reject(rejection));
    const prompt = new Prompt({ radioPrompt, interactive: true });
    const choices = [{ name: "Option 1", value: "opt1" }];

    await assert.rejects(prompt.radio("Choose one", choices), (error) => { assert.strictEqual(error, rejection); return true; });

    assert.strictEqual((prompt["rl"]), undefined);
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

    assert.strictEqual((result), "opt2");
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

    assert.strictEqual((result), "opt1");
    assert.strictEqual((mockQuestion).mock.callCount(), 2);
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

    assert.strictEqual((result), "opt1");
    assert.strictEqual((mockQuestion).mock.callCount(), 2);
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

    assert.deepStrictEqual((result), ["opt1", "opt3"]);
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

    assert.deepStrictEqual((result), ["opt1", "opt3"]);
    assertCalledWith((selectPrompt), { message: "Choose multiple", choices });
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

    assert.deepStrictEqual((result), ["opt2"]);
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

    assert.deepStrictEqual((result), []);
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

    assert.deepStrictEqual((result), ["opt1", "opt2"]);
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

    assert.deepStrictEqual((result), ["opt1"]);
    assert.strictEqual((mockQuestion).mock.callCount(), 2);
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

    assert.deepStrictEqual((result), ["opt1"]);
    assert.strictEqual((mockQuestion).mock.callCount(), 2);
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

    assert.deepStrictEqual((result), ["opt1", "opt2", "opt3"]);
    prompt.close();
  });
});

describe("createPrompt", () => {
  test("should create prompt and execute callback", async () => {
    const result = await createPrompt(async () => "test result");

    assert.strictEqual((result), "test result");
  });

  test("should close prompt after callback", async () => {
    let promptInstance: Prompt | null = null;

    await createPrompt(async (prompt) => {
      promptInstance = prompt;
      return "test";
    });

    assert.notStrictEqual((promptInstance), undefined);
  });

  test("should handle callback errors", async () => {
    try {
      await createPrompt(async () => {
        throw new Error("Test error");
      });
      assert.strictEqual((true), false);
    } catch (err) {
      assert.strictEqual(((err as Error).message), "Test error");
    }
  });
});
