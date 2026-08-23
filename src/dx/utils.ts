import inquirerCheckbox from "@inquirer/checkbox";
import inquirerSelect from "@inquirer/select";
import * as readline from "node:readline";
import { askBinaryHost, hasBinaryHost } from "../cli/utils";
import { logger } from "../observability";
import { createAnsiPattern } from "./constants";
import {
  AFFIRMATIVE_ANSWERS,
  ANSI,
  BOX_CHARS,
  DEFAULT_WIDTH,
  INDENT_SIZE,
  NUMBERED_CHOICE_QUESTION,
  NUMBERED_CHOICES_INSTRUCTIONS,
  NUMBERED_CHOICES_QUESTION,
} from "./constants";
import type {
  BoxOptions,
  ChoicePromptOptions,
  PromptAnswer,
  PromptAnswers,
  PromptChoice,
  PromptDependencies,
  RadioPrompt,
  SelectPrompt,
  TextAlign,
  Output,
} from "./types";

export { inquirerSelect as radio, inquirerCheckbox as select };

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

  return numbers.map((number) => choices[number - 1].value);
};

export class Prompt {
  protected rl: readline.Interface | undefined;
  private readonly radioPrompt: RadioPrompt;
  private readonly selectPrompt: SelectPrompt;
  private readonly interactive: boolean;

  constructor(dependencies: PromptDependencies = {}) {
    this.radioPrompt = dependencies.radioPrompt ?? inquirerSelect;
    this.selectPrompt = dependencies.selectPrompt ?? inquirerCheckbox;
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
    choices.forEach(({ name }, index) => {
      logger.print(`  ${index + 1}. ${name}`);
    });
  }

  private async askForNumberedChoice(choices: PromptChoice[]): PromptAnswer {
    this.ensureCookedMode();
    const answer = await this.ask(NUMBERED_CHOICE_QUESTION);
    const choiceNumber = parseInt(answer.trim(), 10);
    const isValid = isValidChoiceNumber(choiceNumber, choices.length);

    if (isValid) return choices[choiceNumber - 1].value;
    logger.print(invalidChoiceMessage(choices.length));
    return this.askForNumberedChoice(choices);
  }

  private async runInteractive<T>(prompt: () => Promise<T>) {
    this.close();
    const answer = await prompt();
    this.openReadline();
    return answer;
  }

  private interactiveRadio(options: ChoicePromptOptions) {
    return this.runInteractive(() => this.radioPrompt(options));
  }

  radio(message: string, choices: PromptChoice[]) {
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

export const createOutput = (stream: NodeJS.WriteStream = process.stdout): Output => ({
  write: stream.write.bind(stream),
  writeLine: (text) => stream.write(`${text}\n`),
  clearLine: () => stream.write(ANSI.CLEAR_LINE),
  hideCursor: () => stream.write(ANSI.HIDE_CURSOR),
  showCursor: () => stream.write(ANSI.SHOW_CURSOR),
});

export const defaultOutput = createOutput();

export const getTerminalWidth = (): number => process.stdout.columns || DEFAULT_WIDTH;

export const visibleLength = (value: string): number =>
  value.replace(createAnsiPattern(), "").length;

export const pad = (value: string, length: number, align: TextAlign = "left"): string => {
  const paddingLength = Math.max(0, length - visibleLength(value));
  const padding = " ".repeat(paddingLength);
  if (align === "right") return padding + value;
  if (align !== "center") return value + padding;

  const leftPadding = Math.floor(paddingLength / 2);
  const rightPadding = paddingLength - leftPadding;
  return `${" ".repeat(leftPadding)}${value}${" ".repeat(rightPadding)}`;
};

export const truncate = (value: string, maxLength: number): string => {
  if (visibleLength(value) <= maxLength) return value;
  if (maxLength <= 3) return ".".repeat(maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
};

export const indent = (value: string, spaces = INDENT_SIZE): string =>
  `${" ".repeat(spaces)}${value}`;

export const line = (value: string): string => `\n${value}`;

export const item = (number: number, value: string, spaces = INDENT_SIZE): string =>
  `${" ".repeat(spaces)}${number}. ${value}`;

export const divider = (character = "-", length?: number): string =>
  character.repeat(length ?? getTerminalWidth());

const boxTop = (width: number, title?: string): string => {
  const horizontalLine = BOX_CHARS.horizontal.repeat(width - 2);
  if (!title) return `${BOX_CHARS.topLeft}${horizontalLine}${BOX_CHARS.topRight}`;
  const remainingWidth = width - 5 - title.length;
  const trailingLine = BOX_CHARS.horizontal.repeat(Math.max(0, remainingWidth));
  return `${BOX_CHARS.topLeft}${BOX_CHARS.horizontal} ${title} ${trailingLine}${BOX_CHARS.topRight}`;
};

const boxLine = (value: string, innerWidth: number, padding: string): string => {
  const content = pad(truncate(value, innerWidth), innerWidth);
  return `${BOX_CHARS.vertical}${padding}${content}${padding}${BOX_CHARS.vertical}`;
};

export const box = (lines: string[], options: BoxOptions = {}): string[] => {
  const width = options.width ?? Math.min(getTerminalWidth() - 2, 80);
  const paddingWidth = options.padding ?? 1;
  const innerWidth = width - 2 - paddingWidth * 2;
  const padding = " ".repeat(paddingWidth);
  const top = boxTop(width, options.title);
  const bottomLine = BOX_CHARS.horizontal.repeat(width - 2);
  const bottom = `${BOX_CHARS.bottomLeft}${bottomLine}${BOX_CHARS.bottomRight}`;
  const content = lines.map((value) => boxLine(value, innerWidth, padding));
  return [top].concat(content, bottom);
};
