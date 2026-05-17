const ESCAPE_CHARACTER = String.fromCharCode(27);

export const createAnsiPattern = () => new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");
