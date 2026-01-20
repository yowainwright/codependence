import { DEFAULT_WIDTH, INDENT_SIZE, BOX_CHARS, ANSI_PATTERN } from './constants';
import type { BoxOptions, TextAlign } from './types';

export const getTerminalWidth = (): number => {
  return process.stdout.columns || DEFAULT_WIDTH;
};

export const visibleLength = (str: string): number => {
  return str.replace(ANSI_PATTERN, "").length;
};

export const pad = (
  str: string,
  len: number,
  align: TextAlign = "left",
): string => {
  const visible = visibleLength(str);
  const padLen = Math.max(0, len - visible);
  const padding = " ".repeat(padLen);

  if (align === "right") {
    return padding + str;
  }

  if (align === "center") {
    const leftPad = Math.floor(padLen / 2);
    const rightPad = padLen - leftPad;
    return " ".repeat(leftPad) + str + " ".repeat(rightPad);
  }

  return str + padding;
};

export const truncate = (str: string, maxLen: number): string => {
  const visible = visibleLength(str);
  if (visible <= maxLen) return str;
  if (maxLen <= 3) return ".".repeat(maxLen);
  return str.slice(0, maxLen - 3) + "...";
};

export const indent = (str: string, spaces = INDENT_SIZE): string => {
  return " ".repeat(spaces) + str;
};

export const line = (str: string): string => {
  return "\n" + str;
};

export const item = (n: number, str: string, spaces = INDENT_SIZE): string => {
  return " ".repeat(spaces) + `${n}. ${str}`;
};

export const divider = (char = "-", len?: number): string => {
  const lineLen = len ?? getTerminalWidth();
  return char.repeat(lineLen);
};

export const box = (lines: string[], options: BoxOptions = {}): string[] => {
  const boxWidth = options.width ?? Math.min(getTerminalWidth() - 2, 80);
  const padding = options.padding ?? 1;
  const innerWidth = boxWidth - 2 - padding * 2;
  const padStr = " ".repeat(padding);

  const horizontalLine = BOX_CHARS.horizontal.repeat(boxWidth - 2);

  let top: string;
  if (options.title) {
    const titleLength = options.title.length;
    const remainingWidth = boxWidth - 5 - titleLength;
    top = `${BOX_CHARS.topLeft}${BOX_CHARS.horizontal} ${options.title} ${BOX_CHARS.horizontal.repeat(Math.max(0, remainingWidth))}${BOX_CHARS.topRight}`;
  } else {
    top = `${BOX_CHARS.topLeft}${horizontalLine}${BOX_CHARS.topRight}`;
  }

  const bottom = `${BOX_CHARS.bottomLeft}${horizontalLine}${BOX_CHARS.bottomRight}`;

  const contentLines = lines.map((l) => {
    const truncated = truncate(l, innerWidth);
    const padded = pad(truncated, innerWidth);
    return `${BOX_CHARS.vertical}${padStr}${padded}${padStr}${BOX_CHARS.vertical}`;
  });

  return [top, ...contentLines, bottom];
};