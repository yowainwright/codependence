const ESCAPE_CHARACTER = String.fromCharCode(27);

export const GLOB_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g;
export const GLOB_REGEX_CACHE_MAX_SIZE = 200;

export const createAnsiPattern = () => new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");
