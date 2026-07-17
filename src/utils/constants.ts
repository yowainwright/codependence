import { cyan, gray, green, red, yellow } from "./colors";

const ESCAPE_CHARACTER = String.fromCharCode(27);

export const GLOB_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g;
export const GLOB_REGEX_CACHE_MAX_SIZE = 200;
export const SCOPED_PACKAGE_PATTERN = /^(?:@([^/]+?)[/])?([^/]+?)$/;
export const PACKAGE_NAME_EXCLUSIONS = ["node_modules", "favicon.ico"];
export const SPINNER_FRAMES = [
  "\u280b",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283c",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280f",
];
export const LINE_BREAKS = /[\r\n]+/g;
export const VERSION_PREFIXES = ["==", ">=", "<=", "~=", ">", "<", "=", "^", "~"] as const;

export const REPEATING_VERSION_PREFIXES = ["^", "~"] as const;
export const STRICT_INEQUALITY_VERSION_PREFIXES = [">", "<"] as const;
export const VERSION_COMPARISON_PREFIXES = VERSION_PREFIXES.filter(
  (prefix) => !REPEATING_VERSION_PREFIXES.some((repeatable) => repeatable === prefix),
);

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

export const escapeRegex = (value: string): string => value.replace(REGEX_SPECIAL_CHARS, "\\$&");

export const createRegexAlternation = (values: readonly string[]): string =>
  values.map(escapeRegex).join("|");

const repeatingPrefixCharacterClass = REPEATING_VERSION_PREFIXES.map(escapeRegex).join("");

export const VERSION_PREFIX_PATTERN = new RegExp(
  `^(?:${createRegexAlternation(VERSION_COMPARISON_PREFIXES)}|[${repeatingPrefixCharacterClass}]+|v)`,
);

export const createAnsiPattern = () => new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");

export const COMMON_PACKAGES = [
  "lodash",
  "react",
  "react-dom",
  "express",
  "axios",
  "typescript",
  "eslint",
  "prettier",
  "jest",
  "webpack",
  "vite",
  "next",
  "vue",
  "angular",
  "svelte",
  "tailwindcss",
  "prisma",
  "graphql",
  "apollo",
  "redux",
  "mobx",
  "rxjs",
  "date-fns",
  "moment",
  "dayjs",
  "chalk",
  "commander",
  "inquirer",
  "ora",
  "dotenv",
  "nodemon",
  "ts-node",
  "rimraf",
  "concurrently",
];

export const SYMBOLS = {
  success: green("\u2713"),
  error: red("\u2717"),
  warning: yellow("\u25b2"),
  info: cyan("\u25c6"),
  pinned: yellow("\u25a0"),
  dot: gray("\u00b7"),
  severityMajor: red("\u25cf"),
  severityMinor: yellow("\u25cf"),
  severityPatch: green("\u25cf"),
  arrow: cyan(">"),
  bullet: gray(">"),
} as const;

export const RAW_SYMBOLS = {
  success: "\u2713",
  error: "\u2717",
  warning: "\u25b2",
  info: "\u25c6",
  pinned: "\u25a0",
  dot: "\u00b7",
  severityMajor: "\u25cf",
  severityMinor: "\u25cf",
  severityPatch: "\u25cf",
  arrow: ">",
  bullet: ">",
} as const;
