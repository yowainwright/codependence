import * as readline from "readline";
import type { PromptChoice } from "./types";
import { logger } from "../logger";
import { askBinaryHost, hasBinaryHost } from "../bin/runtime";

const isValidChoiceNumber = (value: number, choiceCount: number): boolean => {
  if (isNaN(value)) return false;
  return value >= 1 && value <= choiceCount;
};

export class Prompt {
  protected rl: readline.Interface | undefined;

  constructor() {
    if (hasBinaryHost()) return;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  close(): void {
    this.rl?.close();
  }

  private ensureCookedMode(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  private ask(message: string): Promise<string> {
    const binaryAnswer = askBinaryHost(message);
    if (binaryAnswer) return binaryAnswer;
    if (!this.rl) throw new Error("Prompt input is unavailable");
    const input = this.rl;

    return new Promise((resolve) => {
      input.question(message, resolve);
    });
  }

  input(message: string, defaultValue?: string): Promise<string> {
    return new Promise((resolve) => {
      const prompt = defaultValue ? `${message} (${defaultValue}): ` : `${message}: `;
      this.ensureCookedMode();
      void this.ask(prompt).then((answer) => {
        resolve(answer.trim() || defaultValue || "");
      });
    });
  }

  confirm(message: string, defaultValue = true): Promise<boolean> {
    return new Promise((resolve) => {
      const defaultText = defaultValue ? "Y/n" : "y/N";
      this.ensureCookedMode();
      void this.ask(`${message} (${defaultText}): `).then((answer) => {
        const normalized = answer.trim().toLowerCase();
        if (normalized === "") {
          resolve(defaultValue);
        } else {
          resolve(normalized === "y" || normalized === "yes");
        }
      });
    });
  }

  list(message: string, choices: PromptChoice[]): Promise<string> {
    logger.print(`\n${message}`);

    choices.forEach((choice, index) => {
      logger.print(`  ${index + 1}. ${choice.name}`);
    });

    return new Promise((resolve) => {
      const askForChoice = () => {
        this.ensureCookedMode();
        void this.ask("\nEnter your choice (number): ").then((answer) => {
          const num = parseInt(answer.trim(), 10);

          if (isNaN(num) || num < 1 || num > choices.length) {
            logger.print(
              `▲  Invalid choice. Please enter a number between 1 and ${choices.length}`,
            );
            askForChoice();
          } else {
            resolve(choices[num - 1].value);
          }
        });
      };

      askForChoice();
    });
  }

  checkbox(message: string, choices: PromptChoice[]): Promise<string[]> {
    logger.print(`\n${message}`);
    logger.print("(Use comma-separated numbers, e.g., 1,3,5)\n");

    choices.forEach((choice, index) => {
      logger.print(`  ${index + 1}. ${choice.name}`);
    });

    return new Promise((resolve) => {
      const askForChoices = () => {
        this.ensureCookedMode();
        void this.ask(
          "\nEnter your choices (comma-separated numbers or press Enter for none): ",
        ).then((answer) => {
          const trimmed = answer.trim();

          if (trimmed === "") {
            resolve([]);
            return;
          }

          const numbers = trimmed.split(",").map((n) => parseInt(n.trim(), 10));
          const isValid = numbers.every((number) =>
            isValidChoiceNumber(number, choices.length),
          );

          if (!isValid) {
            logger.print(
              `▲  Invalid input. Please enter numbers between 1 and ${choices.length}, separated by commas.`,
            );
            askForChoices();
          } else {
            const selected = numbers.map((num) => choices[num - 1].value);
            resolve(selected);
          }
        });
      };

      askForChoices();
    });
  }
}

export const createPrompt = async <T>(callback: (prompt: Prompt) => Promise<T>): Promise<T> => {
  const prompt = new Prompt();
  try {
    const result = await callback(prompt);
    return result;
  } finally {
    prompt.close();
  }
};
