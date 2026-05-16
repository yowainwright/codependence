const ESCAPE_CHARACTER = String.fromCharCode(27);

export const ANSI_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");
