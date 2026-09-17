import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatCliStyleguide } from "../../../src/dx/output";
import { runCliStyleguide } from "../../../src/cli/styleguide";

type StyleguidePrompts = NonNullable<Parameters<typeof runCliStyleguide>[1]>;

const restoreEnv = (name: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
};

const setTTY = (stream: { isTTY?: boolean }, value: boolean): (() => void) => {
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

const createWriter = (): {
  state: { messages: string[] };
  write: (message: string) => void;
} => {
  const state = { messages: [] as string[] };
  const write = (message: string): void => {
    state.messages = state.messages.concat(message);
  };
  return { state, write };
};

const interactivePrompts = (
  selections: (string | Error)[],
  selected: string[] | Error,
): {
  prompts: StyleguidePrompts;
  state: { radioMessages: string[]; selectCalls: number[] };
} => {
  const state = { radioMessages: [] as string[], selectCalls: [] as number[] };
  let selectionIndex = 0;
  const prompts: StyleguidePrompts = {
    radio: async ({ message }) => {
      state.radioMessages = state.radioMessages.concat(message);
      const selection = selections[selectionIndex];
      selectionIndex += 1;
      if (selection instanceof Error) throw selection;
      return selection ?? "quit";
    },
    select: async () => {
      state.selectCalls = state.selectCalls.concat(1);
      if (selected instanceof Error) throw selected;
      return selected;
    },
  };
  return { prompts, state };
};

const withInteractiveStyleguide = async (callback: () => Promise<void>): Promise<void> => {
  const previousCi = process.env.CI;
  const previousGitHubActions = process.env.GITHUB_ACTIONS;
  const restoreInputTTY = setTTY(process.stdin, true);
  const restoreOutputTTY = setTTY(process.stdout, true);
  delete process.env.CI;
  delete process.env.GITHUB_ACTIONS;
  try {
    await callback();
  } finally {
    restoreInputTTY();
    restoreOutputTTY();
    restoreEnv("CI", previousCi);
    restoreEnv("GITHUB_ACTIONS", previousGitHubActions);
  }
};

const promptFailureCases = (failure: Error) => [
  { name: "main menu", selections: [failure], selected: [] },
  { name: "return prompt", selections: ["brand", failure, "quit"], selected: [] },
  { name: "radio demo", selections: ["prompts", failure, "quit"], selected: [] },
  { name: "checkbox demo", selections: ["prompts", "alpha", "quit"], selected: failure },
];

describe("CLI styleguide", { concurrency: 1 }, () => {
  const failure = new Error("Terminal input unavailable");
  promptFailureCases(failure).forEach(({ name, selections, selected }) => {
    test(`propagates unexpected errors from the ${name}`, async () => {
      const { write } = createWriter();
      const { prompts } = interactivePrompts(selections, selected);
      await withInteractiveStyleguide(async () => {
        await assert.rejects(runCliStyleguide(write, prompts), (error) => error === failure);
      });
    });
  });

  const cancellation = new Error("Prompt cancelled");
  cancellation.name = "PromptCancelled";
  promptFailureCases(cancellation).forEach(({ name, selections, selected }) => {
    test(`handles cancellation from the ${name}`, async () => {
      const { write } = createWriter();
      const { prompts, state } = interactivePrompts(selections, selected);
      await withInteractiveStyleguide(() => runCliStyleguide(write, prompts));
      const menus = state.radioMessages.filter((message) => message === "Choose a component");
      const expectedMenuCount = name === "main menu" ? 1 : 2;
      assert.strictEqual(menus.length, expectedMenuCount);
    });
  });

  test("prints the static guide outside an interactive terminal", async () => {
    const previousCi = process.env.CI;
    process.env.CI = "1";
    const { state, write } = createWriter();

    try {
      await runCliStyleguide(write);
    } finally {
      restoreEnv("CI", previousCi);
    }

    assert.deepStrictEqual(state.messages, [formatCliStyleguide()]);
  });

  test("walks every interactive section and returns prompt results", async () => {
    const previousCi = process.env.CI;
    const previousGitHubActions = process.env.GITHUB_ACTIONS;
    const restoreInputTTY = setTTY(process.stdin, true);
    const restoreOutputTTY = setTTY(process.stdout, true);
    const selections = [
      "brand",
      "back",
      "statuses",
      "back",
      "tables",
      "back",
      "spinner",
      "back",
      "prompts",
      "alpha",
      "back",
      "quit",
    ];
    const { state: writerState, write } = createWriter();
    const { prompts, state: promptState } = interactivePrompts(selections, ["alpha", "epsilon"]);
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;

    try {
      await runCliStyleguide(write, prompts);
    } finally {
      restoreInputTTY();
      restoreOutputTTY();
      restoreEnv("CI", previousCi);
      restoreEnv("GITHUB_ACTIONS", previousGitHubActions);
    }

    const output = writerState.messages.join("\n");
    assert.strictEqual(promptState.radioMessages.length, selections.length);
    assert.strictEqual(promptState.selectCalls.length, 1);
    assert.ok(promptState.radioMessages.includes("Choose one package"));
    assert.ok(output.includes("Brand and text"));
    assert.ok(output.includes("Statuses and legend"));
    assert.ok(output.includes("Dependency tables"));
    assert.ok(output.includes("Spinner and glimmer"));
    assert.ok(output.includes("Radio and checkbox prompts"));
    assert.ok(output.includes("Radio returned: alpha"));
    assert.ok(output.includes("Checkbox returned: alpha, epsilon"));
  });

  test("returns to the menu when a component prompt is cancelled", async () => {
    const previousCi = process.env.CI;
    const previousGitHubActions = process.env.GITHUB_ACTIONS;
    const restoreInputTTY = setTTY(process.stdin, true);
    const restoreOutputTTY = setTTY(process.stdout, true);
    const { state, write } = createWriter();
    let isInitialMenu = true;
    const prompts: StyleguidePrompts = {
      radio: async ({ message }) => {
        const isMenuSelection = message === "Choose a component";
        const isFirstMenuSelection = isMenuSelection && isInitialMenu;
        if (isFirstMenuSelection) {
          isInitialMenu = false;
          return "prompts";
        }
        return Promise.reject(cancellation);
      },
      select: async () => [],
    };
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;

    try {
      await runCliStyleguide(write, prompts);
    } finally {
      restoreInputTTY();
      restoreOutputTTY();
      restoreEnv("CI", previousCi);
      restoreEnv("GITHUB_ACTIONS", previousGitHubActions);
    }

    const output = state.messages.join("\n");
    assert.ok(output.includes("Codependence CLI Styleguide"));
    assert.ok(output.includes("Radio and checkbox prompts"));
    assert.ok(!output.includes("Radio returned"));
  });
});
