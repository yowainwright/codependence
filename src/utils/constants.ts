const ESCAPE_CHARACTER = String.fromCharCode(27);

export const GLOB_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g;
export const GLOB_REGEX_CACHE_MAX_SIZE = 200;
export const VERSION_PREFIXES = [
  "==",
  ">=",
  "<=",
  "~=",
  ">",
  "<",
  "=",
  "^",
  "~",
] as const;

export const REPEATING_VERSION_PREFIXES = ["^", "~"] as const;
export const STRICT_INEQUALITY_VERSION_PREFIXES = [">", "<"] as const;
export const VERSION_COMPARISON_PREFIXES = VERSION_PREFIXES.filter(
  (prefix) => !REPEATING_VERSION_PREFIXES.some((repeatable) => repeatable === prefix),
);

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

export const escapeRegex = (value: string): string =>
  value.replace(REGEX_SPECIAL_CHARS, "\\$&");

export const createRegexAlternation = (values: readonly string[]): string =>
  values.map(escapeRegex).join("|");

const repeatingPrefixCharacterClass =
  REPEATING_VERSION_PREFIXES.map(escapeRegex).join("");

export const VERSION_PREFIX_PATTERN = new RegExp(
  `^(?:${createRegexAlternation(VERSION_COMPARISON_PREFIXES)}|[${repeatingPrefixCharacterClass}]+|v)`,
);

export const createAnsiPattern = () => new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");
