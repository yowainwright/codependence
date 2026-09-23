import { assertTextIncludes } from "../../helpers/assertions";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatCliStyleguide } from "../../../src/dx/output";
import { runCliStyleguide } from "../../../src/cli/styleguide";

const walksEveryInteractiveSectionAndReturnsPromptResultsSelections = [
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
    radio: ({ message }) => {
      state.radioMessages = state.radioMessages.concat(message);
      const selection = selections[selectionIndex];
      selectionIndex += 1;
      if (selection instanceof Error) return Promise.reject(selection);
      return Promise.resolve(selection ?? "quit");
    },
    select: () => {
      state.selectCalls = state.selectCalls.concat(1);
      if (selected instanceof Error) return Promise.reject(selected);
      return Promise.resolve(selected);
    },
  };
  return { prompts, state };
};

const withInteractiveStyleguide = async (callback: () => Promise<void>): Promise<void> => {
  // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
  const previousCi = process.env.CI;
  // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
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

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
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
    // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
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

  test("renders a yellow warning symbol in the status demo", async () => {
    const { state, write } = createWriter();
    const { prompts } = interactivePrompts(["statuses", "back", "quit"], []);
    await withInteractiveStyleguide(() => runCliStyleguide(write, prompts));
    const output = state.messages.join("\n");
    assertTextIncludes(output, "\u001b[33m⚠\u001b[0m", output);
    assert.match(output, /warning needs review/, output);
    assert.doesNotMatch(output, /undefined/, output);
  });

  test("walks every interactive section and returns prompt results", async () => {
    // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
    const previousCi = process.env.CI;
    // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
    const previousGitHubActions = process.env.GITHUB_ACTIONS;
    const restoreInputTTY = setTTY(process.stdin, true);
    const restoreOutputTTY = setTTY(process.stdout, true);
    const selections = walksEveryInteractiveSectionAndReturnsPromptResultsSelections;
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
    assert.match(output, /Brand and text/);
    assert.match(output, /Statuses and legend/);
    assert.match(output, /Dependency tables/);
    assert.match(output, /Spinner and glimmer/);
    assert.match(output, /Radio and checkbox prompts/);
    assert.match(output, /Radio returned: alpha/);
    assert.match(output, /Checkbox returned: alpha, epsilon/);
  });

  test("returns to the menu when a component prompt is cancelled", async () => {
    // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
    const previousCi = process.env.CI;
    // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
    const previousGitHubActions = process.env.GITHUB_ACTIONS;
    const restoreInputTTY = setTTY(process.stdin, true);
    const restoreOutputTTY = setTTY(process.stdout, true);
    const { state, write } = createWriter();
    let isInitialMenu = true;
    const prompts: StyleguidePrompts = {
      radio: ({ message }) => {
        const isMenuSelection = message === "Choose a component";
        const isFirstMenuSelection = isMenuSelection && isInitialMenu;
        if (isFirstMenuSelection) {
          isInitialMenu = false;
          return Promise.resolve("prompts");
        }
        return Promise.resolve(Promise.reject(cancellation));
      },
      select: () => Promise.resolve([]),
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
    assert.match(output, /Codependence CLI Styleguide/);
    assert.match(output, /Radio and checkbox prompts/);
    assert.doesNotMatch(output, /Radio returned/);
  });
});
