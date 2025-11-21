export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface GlobOptions {
  cwd?: string;
  ignore?: string[];
  absolute?: boolean;
}

export interface PromptChoice {
  name: string;
  value: string;
}

export interface SpinnerState {
  text: string;
  isSpinning: boolean;
  frameIndex: number;
  interval: NodeJS.Timeout | null;
}

export interface Spinner {
  start: () => Spinner;
  stop: () => Spinner;
  succeed: (text?: string) => Spinner;
  fail: (text?: string) => Spinner;
  info: (text?: string) => Spinner;
  warn: (text?: string) => Spinner;
}

export interface ConfigResult {
  config: Record<string, unknown>;
  filepath?: string;
  isEmpty?: boolean;
}
