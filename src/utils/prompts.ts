import * as readline from "readline";
import type { PromptChoice } from "./types";

export class Prompt {
  protected rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  close(): void {
    this.rl.close();
  }

  private ensureCookedMode(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  async input(message: string, defaultValue?: string): Promise<string> {
    return new Promise((resolve) => {
      const prompt = defaultValue
        ? `${message} (${defaultValue}): `
        : `${message}: `;
      this.ensureCookedMode();
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim() || defaultValue || "");
      });
    });
  }

  async confirm(message: string, defaultValue = true): Promise<boolean> {
    return new Promise((resolve) => {
      const defaultText = defaultValue ? "Y/n" : "y/N";
      this.ensureCookedMode();
      this.rl.question(`${message} (${defaultText}): `, (answer) => {
        const normalized = answer.trim().toLowerCase();
        if (normalized === "") {
          resolve(defaultValue);
        } else {
          resolve(normalized === "y" || normalized === "yes");
        }
      });
    });
  }

  async list(message: string, choices: PromptChoice[]): Promise<string> {
    console.log(`\n${message}`);

    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice.name}`);
    });

    return new Promise((resolve) => {
      const askForChoice = () => {
        this.ensureCookedMode();
        this.rl.question("\nEnter your choice (number): ", (answer) => {
          const num = parseInt(answer.trim(), 10);

          if (isNaN(num) || num < 1 || num > choices.length) {
            console.log(
              `⚠️  Invalid choice. Please enter a number between 1 and ${choices.length}`,
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

  async checkbox(message: string, choices: PromptChoice[]): Promise<string[]> {
    console.log(`\n${message}`);
    console.log("(Use comma-separated numbers, e.g., 1,3,5)\n");

    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice.name}`);
    });

    return new Promise((resolve) => {
      const askForChoices = () => {
        this.ensureCookedMode();
        this.rl.question(
          "\nEnter your choices (comma-separated numbers or press Enter for none): ",
          (answer) => {
            const trimmed = answer.trim();

            if (trimmed === "") {
              resolve([]);
              return;
            }

            const numbers = trimmed
              .split(",")
              .map((n) => parseInt(n.trim(), 10));
            const isValid = numbers.every(
              (num) => !isNaN(num) && num >= 1 && num <= choices.length,
            );

            if (!isValid) {
              console.log(
                `⚠️  Invalid input. Please enter numbers between 1 and ${choices.length}, separated by commas.`,
              );
              askForChoices();
            } else {
              const selected = numbers.map((num) => choices[num - 1].value);
              resolve(selected);
            }
          },
        );
      };

      askForChoices();
    });
  }
}

export const createPrompt = async <T>(
  callback: (prompt: Prompt) => Promise<T>,
): Promise<T> => {
  const prompt = new Prompt();
  try {
    const result = await callback(prompt);
    return result;
  } finally {
    prompt.close();
  }
};
