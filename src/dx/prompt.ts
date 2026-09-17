import * as readline from "node:readline";
import { askBinaryHost, hasBinaryHost } from "../cli/utils";
import { logger } from "../observability";
import { ANSI } from "./constants";
import {
  AFFIRMATIVE_ANSWERS,
  NUMBERED_CHOICE_QUESTION,
  NUMBERED_CHOICES_INSTRUCTIONS,
  NUMBERED_CHOICES_QUESTION,
} from "./constants";
import { getTerminalWidth, truncate } from "./utils";
import type {
  ChoicePromptOptions,
  PromptAnswer,
  PromptAnswers,
  PromptChoice,
  PromptDependencies,
  RadioPrompt,
  SelectPrompt,
} from "./types";

const SELECTOR_VIEWPORT_SIZE = 8;
const SELECTOR_CURSOR = "›";
const CHECKED_MARK = "■";
const UNCHECKED_MARK = "□";
const RADIO_SELECTED_MARK = "●";
const RADIO_UNSELECTED_MARK = "○";
const DISABLED_MARK = "─";
const RADIO_INSTRUCTIONS = "↑/↓ navigate · Enter select · Esc cancel";
const SELECT_INSTRUCTIONS =
  "↑/↓ navigate · Space toggle · a all · n none · Enter confirm · Esc cancel";
const COMPACT_RADIO_INSTRUCTIONS = "↑/↓ move · Enter · Esc";
const COMPACT_SELECT_INSTRUCTIONS = "↑/↓ move · Space toggle · a/n · Enter · Esc";

type SelectorMode = "radio" | "select";
type SelectorState = {
  cursorIndex: number;
  selected: boolean[];
  viewportStart: number;
};
type PromptKey = { name?: string; ctrl?: boolean };

const hasChoices = (choices: PromptChoice[]): boolean => choices.length > 0;
const isDisabled = (choice: PromptChoice): boolean => {
  const disabled = choice.disabled;
  const hasDisabledValue = Boolean(disabled);
  const hasDisabledLabel = typeof disabled === "string";
  return hasDisabledValue || hasDisabledLabel;
};

const radioChoiceError = (choices: PromptChoice[]): Error | undefined => {
  if (!hasChoices(choices)) return new Error("Prompt requires at least one choice");
  const hasEnabledChoice = choices.some((choice) => !isDisabled(choice));
  if (hasEnabledChoice) return;
  return new Error("Radio prompt requires at least one enabled choice");
};

const firstSelectableIndex = (choices: PromptChoice[]): number => {
  const index = choices.findIndex((choice) => !isDisabled(choice));
  if (index < 0) return 0;
  return index;
};

const createSelectorState = (choices: PromptChoice[]): SelectorState => {
  const cursorIndex = firstSelectableIndex(choices);
  const selected = choices.map((choice) => Boolean(choice.checked) && !isDisabled(choice));
  const viewportStart = updateViewportStart(cursorIndex, 0, choices.length);
  return { cursorIndex, selected, viewportStart };
};

const moveCursor = (cursorIndex: number, direction: number, choices: PromptChoice[]): number => {
  const nextIndexes = choices.map(
    (_, offset) => (cursorIndex + direction * (offset + 1) + choices.length) % choices.length,
  );
  return nextIndexes.find((index) => !isDisabled(choices[index])) ?? cursorIndex;
};

const updateViewportStart = (cursorIndex: number, viewportStart: number, choiceCount: number) => {
  const maxStart = Math.max(0, choiceCount - SELECTOR_VIEWPORT_SIZE);
  if (cursorIndex < viewportStart) return cursorIndex;
  if (cursorIndex >= viewportStart + SELECTOR_VIEWPORT_SIZE) {
    const nextStart = cursorIndex - SELECTOR_VIEWPORT_SIZE + 1;
    return Math.min(maxStart, nextStart);
  }
  return viewportStart;
};

const moveSelector = (state: SelectorState, direction: number, choices: PromptChoice[]) => {
  const cursorIndex = moveCursor(state.cursorIndex, direction, choices);
  const viewportStart = updateViewportStart(cursorIndex, state.viewportStart, choices.length);
  return Object.assign({}, state, { cursorIndex, viewportStart });
};

const activeText = (text: string, active: boolean): string => {
  if (!active) return text;
  return `${ANSI.BOLD}${ANSI.CYAN}${text}${ANSI.RESET}`;
};

const mutedText = (text: string): string => `${ANSI.GRAY}${text}${ANSI.RESET}`;

const choiceMark = (choice: PromptChoice, selected: boolean, mode: SelectorMode): string => {
  if (isDisabled(choice)) return DISABLED_MARK;
  if (mode === "radio") return selected ? RADIO_SELECTED_MARK : RADIO_UNSELECTED_MARK;
  return selected ? CHECKED_MARK : UNCHECKED_MARK;
};

const formatChoice = (
  mode: SelectorMode,
  choice: PromptChoice,
  index: number,
  state: SelectorState,
): string => {
  const isActive = index === state.cursorIndex;
  const selected = mode === "radio" ? isActive : state.selected[index];
  const prefix = `${isActive ? SELECTOR_CURSOR : " "} ${choiceMark(choice, selected, mode)} `;
  const descriptionValue =
    choice.description ?? (typeof choice.disabled === "string" ? choice.disabled : "");
  const description = descriptionValue ? ` · ${descriptionValue}` : "";
  const availableWidth = Math.max(1, getTerminalWidth() - prefix.length);
  const descriptionWidth = Math.max(
    0,
    availableWidth - Math.min(choice.name.length, availableWidth),
  );
  const visibleDescription = descriptionWidth > 0 ? truncate(description, descriptionWidth) : "";
  const labelWidth = Math.max(1, availableWidth - visibleDescription.length);
  const label = truncate(choice.name, labelWidth);
  const text = `${prefix}${label}`;
  const detail = visibleDescription ? `${ANSI.GRAY}${visibleDescription}${ANSI.RESET}` : "";
  const formatted = `${text}${detail}`;
  if (isDisabled(choice)) return `${ANSI.GRAY}${formatted}${ANSI.RESET}`;
  return activeText(formatted, isActive);
};

const selectedCount = (selected: boolean[]): number => selected.filter(Boolean).length;

const selectedSummary = (
  mode: SelectorMode,
  choices: PromptChoice[],
  state: SelectorState,
): string => {
  if (mode === "radio") return "";
  const labels = choices.filter((_, index) => state.selected[index]).map(({ name }) => name);
  if (labels.length === 0) return "Selected: none";
  return `Selected: ${labels.join(", ")}`;
};

const selectorFooter = (mode: SelectorMode, state: SelectorState, choiceCount: number): string => {
  const hasPrevious = state.viewportStart > 0;
  const hasNext = state.viewportStart + SELECTOR_VIEWPORT_SIZE < choiceCount;
  const scrollHint = [hasPrevious ? "↑ more" : "", hasNext ? "↓ more" : ""].filter(Boolean);
  const useCompactInstructions = getTerminalWidth() < 96;
  const fullInstructions = mode === "radio" ? RADIO_INSTRUCTIONS : SELECT_INSTRUCTIONS;
  const compactInstructions =
    mode === "radio" ? COMPACT_RADIO_INSTRUCTIONS : COMPACT_SELECT_INSTRUCTIONS;
  const instructions = useCompactInstructions ? compactInstructions : fullInstructions;
  const count = mode === "radio" ? "" : `${selectedCount(state.selected)} selected`;
  const footer = scrollHint.concat([instructions, count]).filter(Boolean).join(" · ");
  return mutedText(truncate(footer, getTerminalWidth()));
};

const selectorFrame = (
  mode: SelectorMode,
  message: string,
  choices: PromptChoice[],
  state: SelectorState,
): string[] => {
  const title = `${ANSI.BOLD}${ANSI.CYAN}?${ANSI.RESET} ${truncate(
    message,
    Math.max(1, getTerminalWidth() - 2),
  )}`;
  const visibleChoices = choices.slice(
    state.viewportStart,
    state.viewportStart + SELECTOR_VIEWPORT_SIZE,
  );
  const choiceLines = visibleChoices.map((choice, offset) =>
    formatChoice(mode, choice, state.viewportStart + offset, state),
  );
  const footer = selectorFooter(mode, state, choices.length);
  const summary = selectedSummary(mode, choices, state);
  const summaryLine = summary ? mutedText(truncate(summary, getTerminalWidth())) : "";
  return [title, ...choiceLines, footer, ...(summaryLine ? [summaryLine] : [])];
};

const writeFrame = (lines: string[], previousLineCount: number, isFirstFrame = false): number => {
  if (isFirstFrame) process.stdout.write("\n");
  if (previousLineCount > 0) {
    readline.moveCursor(process.stdout, 0, -(previousLineCount - 1));
  }
  readline.cursorTo(process.stdout, 0);
  readline.clearScreenDown(process.stdout);
  process.stdout.write(lines.join("\n"));
  return lines.length;
};

const selectedValues = (
  mode: SelectorMode,
  choices: PromptChoice[],
  state: SelectorState,
): string | string[] => {
  if (mode === "radio") return choices[state.cursorIndex]?.value ?? "";
  return choices.filter((_, index) => state.selected[index]).map(({ value }) => value);
};

const selectedLabels = (
  mode: SelectorMode,
  choices: PromptChoice[],
  state: SelectorState,
): string[] => {
  if (mode === "radio") return [choices[state.cursorIndex]?.name ?? ""];
  return choices.filter((_, index) => state.selected[index]).map(({ name }) => name);
};

const finalFrame = (
  mode: SelectorMode,
  message: string,
  choices: PromptChoice[],
  state: SelectorState,
): string[] => {
  const labels = selectedLabels(mode, choices, state);
  const summary = labels.length > 0 ? labels.join(", ") : "none selected";
  const availableWidth = Math.max(1, getTerminalWidth() - message.length - 4);
  const text = `${message}: ${truncate(summary, availableWidth)}`;
  return [`${ANSI.BOLD}${ANSI.GREEN}✔${ANSI.RESET} ${text}`];
};

const cancelFrame = (message: string): string[] => [
  `${ANSI.BOLD}${ANSI.RED}✗${ANSI.RESET} ${message}: cancelled`,
];

const promptCancelled = (): Error => {
  const error = new Error("Prompt cancelled");
  error.name = "PromptCancelled";
  return error;
};

const isCancelKey = (input: string, key: PromptKey): boolean => {
  const isEscapeKey = key.name === "escape";
  const isEscapeInput = input === "\u001b";
  const isEscape = isEscapeKey || isEscapeInput;
  const isControlC = Boolean(key.ctrl) && key.name === "c";
  return isEscape || isControlC;
};

const isConfirmKey = (key: PromptKey): boolean => key.name === "return" || key.name === "enter";

const cursorDirection = (key: PromptKey): number => {
  if (key.name === "up") return -1;
  if (key.name === "down") return 1;
  return 0;
};

const updateSelected = (
  state: SelectorState,
  input: string,
  key: PromptKey,
  choices: PromptChoice[],
): SelectorState => {
  const currentChoice = choices[state.cursorIndex];
  if (isDisabled(currentChoice)) return state;

  const isSpace = key.name === "space" || input === " ";
  if (isSpace) {
    const selected = state.selected.map((value, index) => {
      const isCursor = index === state.cursorIndex;
      if (!isCursor) return value;
      return !value;
    });
    return Object.assign({}, state, { selected });
  }

  const shortcut = input.toLowerCase();
  if (shortcut === "a") {
    return Object.assign({}, state, {
      selected: choices.map((choice) => !isDisabled(choice)),
    });
  }
  if (shortcut === "n")
    return Object.assign({}, state, { selected: state.selected.map(() => false) });
  return state;
};

const isSelectionKey = (input: string, key: PromptKey): boolean => {
  const isSpace = key.name === "space" || input === " ";
  const shortcut = input.toLowerCase();
  const isShortcut = shortcut === "a" || shortcut === "n";
  return isSpace || isShortcut;
};

const runSelector = (
  mode: SelectorMode,
  { message, choices }: ChoicePromptOptions,
): Promise<string | string[]> =>
  new Promise((resolve, reject) => {
    if (!hasChoices(choices)) {
      reject(new Error("Prompt requires at least one choice"));
      return;
    }

    let state = createSelectorState(choices);
    let previousLineCount = 0;
    let isFinished = false;

    const cleanup = (onRestored?: () => void): void => {
      process.stdin.off("keypress", onKeypress);
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      if (typeof process.stdin.setRawMode === "function") process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(ANSI.SHOW_CURSOR, onRestored);
    };

    const onSignal = (signal: NodeJS.Signals): void => {
      if (isFinished) return;
      isFinished = true;
      cleanup(() => process.kill(process.pid, signal));
    };

    const onInterrupt = (): void => onSignal("SIGINT");
    const onTerminate = (): void => onSignal("SIGTERM");

    const finish = (value?: string | string[], error?: Error): void => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      const lines = error ? cancelFrame(message) : finalFrame(mode, message, choices, state);
      writeFrame(lines, previousLineCount);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const render = (): void => {
      const lines = selectorFrame(mode, message, choices, state);
      previousLineCount = writeFrame(lines, previousLineCount, previousLineCount === 0);
    };

    const onKeypress = (input = "", key: PromptKey = {}): void => {
      if (isCancelKey(input, key)) {
        finish(undefined, promptCancelled());
        return;
      }
      if (isConfirmKey(key)) {
        const isDisabledRadioChoice = mode === "radio" && isDisabled(choices[state.cursorIndex]);
        if (isDisabledRadioChoice) return;
        finish(selectedValues(mode, choices, state));
        return;
      }

      const direction = cursorDirection(key);
      if (direction !== 0) {
        state = moveSelector(state, direction, choices);
        render();
        return;
      }
      const isSelectShortcut = mode === "select" && isSelectionKey(input, key);
      if (isSelectShortcut) {
        state = updateSelected(state, input, key, choices);
        render();
      }
    };

    try {
      const hasRawMode = typeof process.stdin.setRawMode === "function";
      const hasInteractiveInput = hasInteractiveTerminal();
      if (!hasInteractiveInput) {
        throw new Error("Interactive prompt input is unavailable");
      }
      if (!hasRawMode) {
        throw new Error("Interactive prompt input is unavailable");
      }
      process.once("SIGINT", onInterrupt);
      process.once("SIGTERM", onTerminate);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      readline.emitKeypressEvents(process.stdin);
      process.stdin.on("keypress", onKeypress);
      process.stdout.write(ANSI.HIDE_CURSOR);
      render();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });

export const radio: RadioPrompt = (options) => {
  const error = radioChoiceError(options.choices);
  if (error) return Promise.reject(error);
  return runSelector("radio", options).then((value) => value as string);
};

export const select: SelectPrompt = (options) =>
  runSelector("select", options).then((value) => value as string[]);

const hasInteractiveTerminal = (): boolean => {
  const hasInputTerminal = Boolean(process.stdin.isTTY);
  const hasOutputTerminal = Boolean(process.stdout.isTTY);

  return hasInputTerminal && hasOutputTerminal;
};

const isValidChoiceNumber = (value: number, choiceCount: number): boolean => {
  if (Number.isNaN(value)) return false;
  const meetsMinimum = value >= 1;
  const meetsMaximum = value <= choiceCount;

  return meetsMinimum && meetsMaximum;
};

const invalidChoiceMessage = (choiceCount: number): string =>
  `▲  Invalid choice. Please enter a number between 1 and ${choiceCount}`;

const invalidChoicesMessage = (choiceCount: number): string =>
  `▲  Invalid input. Please enter numbers between 1 and ${choiceCount}, separated by commas.`;

const parseSelectedChoices = (answer: string, choices: PromptChoice[]): string[] | undefined => {
  const normalized = answer.trim();
  if (!normalized) return [];

  const numbers = normalized.split(",").map((value) => parseInt(value.trim(), 10));
  const areValid = numbers.every((number) => isValidChoiceNumber(number, choices.length));
  if (!areValid) return undefined;

  const selectedChoices = numbers.map((number) => choices[number - 1]);
  const hasUnavailableChoice = selectedChoices.some((choice) => !choice || isDisabled(choice));
  if (hasUnavailableChoice) return undefined;

  return selectedChoices.map((choice) => choice?.value ?? "");
};

export class Prompt {
  protected rl: readline.Interface | undefined;
  private readonly radioPrompt: RadioPrompt;
  private readonly selectPrompt: SelectPrompt;
  private readonly interactive: boolean;

  constructor(dependencies: PromptDependencies = {}) {
    this.radioPrompt = dependencies.radioPrompt ?? radio;
    this.selectPrompt = dependencies.selectPrompt ?? select;
    this.interactive = dependencies.interactive ?? hasInteractiveTerminal();
    this.openReadline();
  }

  private openReadline(): void {
    const hasReadline = Boolean(this.rl);
    const cannotOpen = hasBinaryHost() || hasReadline;
    if (cannotOpen) return;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  close(): void {
    this.rl?.close();
    this.rl = undefined;
  }

  private ensureCookedMode(): void {
    if (!process.stdin.isTTY) return;
    process.stdin.setRawMode(false);
  }

  private ask(message: string) {
    const binaryAnswer = askBinaryHost(message);
    if (binaryAnswer) return binaryAnswer;
    if (!this.rl) throw new Error("Prompt input is unavailable");

    return new Promise<string>((resolve) => {
      this.rl?.question(message, resolve);
    });
  }

  async input(message: string, defaultValue?: string) {
    const defaultText = defaultValue ? ` (${defaultValue})` : "";
    this.ensureCookedMode();
    const answer = await this.ask(`${message}${defaultText}: `);
    const normalized = answer.trim();

    if (normalized) return normalized;
    return defaultValue ?? "";
  }

  async confirm(message: string, defaultValue = true) {
    const defaultText = defaultValue ? "Y/n" : "y/N";
    this.ensureCookedMode();
    const answer = await this.ask(`${message} (${defaultText}): `);
    const normalized = answer.trim().toLowerCase();

    if (!normalized) return defaultValue;
    return AFFIRMATIVE_ANSWERS.includes(normalized);
  }

  private printNumberedChoices(message: string, choices: PromptChoice[]): void {
    logger.print(`\n${message}`);
    choices.forEach((choice, index) => {
      const description = choice.description ? ` — ${choice.description}` : "";
      const disabledReason = typeof choice.disabled === "string" ? choice.disabled : "disabled";
      const disabledText = isDisabled(choice) ? ` (${disabledReason})` : "";
      logger.print(`  ${index + 1}. ${choice.name}${description}${disabledText}`);
    });
  }

  private async askForNumberedChoice(choices: PromptChoice[]): PromptAnswer {
    this.ensureCookedMode();
    const answer = await this.ask(NUMBERED_CHOICE_QUESTION);
    const choiceNumber = parseInt(answer.trim(), 10);
    const isValid =
      isValidChoiceNumber(choiceNumber, choices.length) && !isDisabled(choices[choiceNumber - 1]);

    if (isValid) return choices[choiceNumber - 1].value;
    logger.print(invalidChoiceMessage(choices.length));
    return this.askForNumberedChoice(choices);
  }

  private async runInteractive<T>(prompt: () => Promise<T>) {
    this.close();
    const result = await prompt();
    this.openReadline();
    return result;
  }

  private interactiveRadio(options: ChoicePromptOptions) {
    return this.runInteractive(() => this.radioPrompt(options));
  }

  radio(message: string, choices: PromptChoice[]) {
    const error = radioChoiceError(choices);
    if (error) return Promise.reject(error);
    const usesRadio = this.interactive && !hasBinaryHost();
    if (usesRadio) return this.interactiveRadio({ message, choices });

    this.printNumberedChoices(message, choices);
    return this.askForNumberedChoice(choices);
  }

  private async askForNumberedChoices(choices: PromptChoice[]): PromptAnswers {
    this.ensureCookedMode();
    const answer = await this.ask(NUMBERED_CHOICES_QUESTION);
    const selected = parseSelectedChoices(answer, choices);

    if (selected) return selected;
    logger.print(invalidChoicesMessage(choices.length));
    return this.askForNumberedChoices(choices);
  }

  private numberedSelect(message: string, choices: PromptChoice[]) {
    this.printNumberedChoices(message, choices);
    logger.print(NUMBERED_CHOICES_INSTRUCTIONS);
    return this.askForNumberedChoices(choices);
  }

  private interactiveSelect(options: ChoicePromptOptions) {
    return this.runInteractive(() => this.selectPrompt(options));
  }

  select(message: string, choices: PromptChoice[]) {
    if (!hasChoices(choices))
      return Promise.reject(new Error("Prompt requires at least one choice"));
    const usesSelect = this.interactive && !hasBinaryHost();
    if (usesSelect) return this.interactiveSelect({ message, choices });

    return this.numberedSelect(message, choices);
  }
}

export const createPrompt = async <T>(callback: (prompt: Prompt) => Promise<T>): Promise<T> => {
  const prompt = new Prompt();
  try {
    return await callback(prompt);
  } finally {
    prompt.close();
  }
};
