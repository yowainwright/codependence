export interface SpinnerState {
  text: string;
  interactive: boolean;
  isSpinning: boolean;
  frameIndex: number;
  interval: NodeJS.Timeout | null;
}

export interface Spinner {
  text: string;
  start: () => Spinner;
  stop: () => Spinner;
  succeed: (text?: string) => Spinner;
  fail: (text?: string) => Spinner;
  info: (text?: string) => Spinner;
  warn: (text?: string) => Spinner;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export interface TableRow {
  [key: string]: string;
}

export interface TableVersionDiff {
  package: string;
  current: string;
  latest: string;
  isPinned: boolean;
}
