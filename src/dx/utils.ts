import { createAnsiPattern } from "./constants";
import { ANSI, BOX_CHARS, DEFAULT_WIDTH, INDENT_SIZE } from "./constants";
import type { BoxOptions, TextAlign, Output } from "./types";

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
