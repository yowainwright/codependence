export type Output = {
  write: (text: string) => void;
  writeLine: (text: string) => void;
  clearLine: () => void;
  hideCursor: () => void;
  showCursor: () => void;
};

export interface BoxOptions {
  width?: number;
  padding?: number;
  title?: string;
}

export type TextAlign = "left" | "right" | "center";

export interface PromptChoice {
  name: string;
  value: string;
}

export interface ChoicePromptOptions {
  message: string;
  choices: PromptChoice[];
}

export type RadioPrompt = (options: ChoicePromptOptions) => Promise<string>;
export type SelectPrompt = (options: ChoicePromptOptions) => Promise<string[]>;
export type PromptAnswer = Promise<string>;
export type PromptAnswers = Promise<string[]>;

export interface PromptDependencies {
  radioPrompt?: RadioPrompt;
  selectPrompt?: SelectPrompt;
  interactive?: boolean;
}
