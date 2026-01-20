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