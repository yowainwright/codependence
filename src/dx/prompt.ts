import * as readline from "readline";
import { askBinaryHost, hasBinaryHost } from "../bin/utils";
import { logger } from "../logger";
import {
  AFFIRMATIVE_ANSWERS,
  NUMBERED_CHOICE_QUESTION,
  NUMBERED_CHOICES_INSTRUCTIONS,
  NUMBERED_CHOICES_QUESTION,
} from "./constants";
import { radio } from "./radio";
import { select } from "./select";
import type {
  ChoicePromptOptions,
  PromptAnswer,
  PromptAnswers,
  PromptChoice,
  PromptDependencies,
  RadioPrompt,
  SelectPrompt,
} from "./types";

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
    try {
      return await prompt();
    } finally {
      this.openReadline();
    }
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
