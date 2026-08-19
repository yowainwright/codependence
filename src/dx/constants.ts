const ESCAPE_CHARACTER = String.fromCharCode(27);

export const createAnsiPattern = () => new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");

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
  CLEAR_LINE: "\r\x1B[K",
  HIDE_CURSOR: "\x1B[?25l",
  SHOW_CURSOR: "\x1B[?25h",
  RESET: "\x1b[0m",
} as const;

export const NUMBERED_CHOICE_QUESTION = "\nEnter your choice (number): ";
export const NUMBERED_CHOICES_QUESTION =
  "\nEnter your choices (comma-separated numbers or press Enter for none): ";
export const NUMBERED_CHOICES_INSTRUCTIONS = "(Use comma-separated numbers, e.g., 1,3,5)\n";
export const AFFIRMATIVE_ANSWERS: readonly string[] = ["y", "yes"];
