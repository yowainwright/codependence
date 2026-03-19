export const DEFAULT_WIDTH = 80;
export const INDENT_SIZE = 2;

export const BOX_CHARS = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
} as const;

export const ANSI = {
  CLEAR_LINE: '\r\x1B[K',
  HIDE_CURSOR: '\x1B[?25l',
  SHOW_CURSOR: '\x1B[?25h',
  RESET: '\x1b[0m',
} as const;

export const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;