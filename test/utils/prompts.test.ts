import { describe, test, expect, mock } from "bun:test";
import { Prompt, createPrompt } from "../../src/utils/prompts";
import * as readline from "readline";

describe("Prompt", () => {
  test("should create readline interface on construction", () => {
    const prompt = new Prompt();
    expect(prompt).toBeDefined();
    prompt.close();
  });

  test("should close readline interface", () => {
    const prompt = new Prompt();
    prompt.close();
    expect(true).toBe(true);
  });

  test("input should resolve with answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("test answer");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question");

    expect(result).toBe("test answer");
    expect(mockQuestion).toHaveBeenCalled();
    prompt.close();
  });

  test("input should use default value when answer is empty", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question", "default");

    expect(result).toBe("default");
    prompt.close();
  });

  test("input should trim answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("  answer  ");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.input("Test question");

    expect(result).toBe("answer");
    prompt.close();
  });

  test("confirm should resolve true for y", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("y");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    expect(result).toBe(true);
    prompt.close();
  });

  test("confirm should resolve true for yes", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("yes");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    expect(result).toBe(true);
    prompt.close();
  });

  test("confirm should resolve false for n", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("n");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    expect(result).toBe(false);
    prompt.close();
  });

  test("confirm should resolve false for no", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("no");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    expect(result).toBe(false);
    prompt.close();
  });

  test("confirm should use default value for empty answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question", true);

    expect(result).toBe(true);
    prompt.close();
  });

  test("confirm should use default false for empty answer", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question", false);

    expect(result).toBe(false);
    prompt.close();
  });

  test("confirm should be case insensitive", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("Y");
    });
    prompt["rl"].question = mockQuestion;

    const result = await prompt.confirm("Test question");

    expect(result).toBe(true);
    prompt.close();
  });

  test("list should resolve with selected choice value", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("1");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.list("Choose one", choices);

    expect(result).toBe("opt1");
    prompt.close();
  });

  test("list should handle second choice", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("2");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.list("Choose one", choices);

    expect(result).toBe("opt2");
    prompt.close();
  });

  test("list should re-prompt on invalid number", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("99");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.list("Choose one", choices);

    expect(result).toBe("opt1");
    expect(mockQuestion).toHaveBeenCalledTimes(2);
    prompt.close();
  });

  test("list should re-prompt on non-numeric input", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("abc");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.list("Choose one", choices);

    expect(result).toBe("opt1");
    expect(mockQuestion).toHaveBeenCalledTimes(2);
    prompt.close();
  });

  test("checkbox should resolve with selected choice values", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("1,3");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
      { name: "Option 3", value: "opt3" },
    ];

    const result = await prompt.checkbox("Choose multiple", choices);

    expect(result).toEqual(["opt1", "opt3"]);
    prompt.close();
  });

  test("checkbox should handle single selection", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("2");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.checkbox("Choose multiple", choices);

    expect(result).toEqual(["opt2"]);
    prompt.close();
  });

  test("checkbox should resolve empty array for empty input", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.checkbox("Choose multiple", choices);

    expect(result).toEqual([]);
    prompt.close();
  });

  test("checkbox should handle whitespace in input", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb(" 1 , 2 ");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
    ];

    const result = await prompt.checkbox("Choose multiple", choices);

    expect(result).toEqual(["opt1", "opt2"]);
    prompt.close();
  });

  test("checkbox should re-prompt on invalid numbers", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("1,99");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.checkbox("Choose multiple", choices);

    expect(result).toEqual(["opt1"]);
    expect(mockQuestion).toHaveBeenCalledTimes(2);
    prompt.close();
  });

  test("checkbox should re-prompt on non-numeric input", async () => {
    const prompt = new Prompt();
    let callCount = 0;
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      callCount++;
      if (callCount === 1) {
        cb("a,b");
      } else {
        cb("1");
      }
    });
    prompt["rl"].question = mockQuestion;

    const choices = [{ name: "Option 1", value: "opt1" }];

    const result = await prompt.checkbox("Choose multiple", choices);

    expect(result).toEqual(["opt1"]);
    expect(mockQuestion).toHaveBeenCalledTimes(2);
    prompt.close();
  });

  test("checkbox should handle all selections", async () => {
    const prompt = new Prompt();
    const mockQuestion = mock((q: string, cb: (answer: string) => void) => {
      cb("1,2,3");
    });
    prompt["rl"].question = mockQuestion;

    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "Option 2", value: "opt2" },
      { name: "Option 3", value: "opt3" },
    ];

    const result = await prompt.checkbox("Choose multiple", choices);

    expect(result).toEqual(["opt1", "opt2", "opt3"]);
    prompt.close();
  });
});

describe("createPrompt", () => {
  test("should create prompt and execute callback", async () => {
    const result = await createPrompt(async (prompt) => {
      return "test result";
    });

    expect(result).toBe("test result");
  });

  test("should close prompt after callback", async () => {
    let promptInstance: Prompt | null = null;

    await createPrompt(async (prompt) => {
      promptInstance = prompt;
      return "test";
    });

    expect(promptInstance).toBeDefined();
  });

  test("should handle callback errors", async () => {
    try {
      await createPrompt(async () => {
        throw new Error("Test error");
      });
      expect(true).toBe(false);
    } catch (err) {
      expect((err as Error).message).toBe("Test error");
    }
  });
});
