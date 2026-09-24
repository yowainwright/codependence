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
  description?: string;
  checked?: boolean;
  disabled?: boolean | string;
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

export type SelectorMode = "radio" | "select";
export type SelectorState = {
  cursorIndex: number;
  selected: boolean[];
  viewportStart: number;
};
export type PromptKey = { name?: string; ctrl?: boolean };

export interface SelectorSession extends ChoicePromptOptions {
  mode: SelectorMode;
  state: SelectorState;
  previousLineCount: number;
  isFinished: boolean;
  resolve: (value: string | string[]) => void;
  reject: (error: unknown) => void;
  onKeypress: (input?: string, key?: PromptKey) => void;
  onInterrupt: () => void;
  onTerminate: () => void;
}
