export const CARGO_PACKAGE_MANAGER = "cargo";

export const CARGO_SECTION_TYPES = {
  BUILD: "build",
  DEPENDENCY: "dependency",
  DEV: "dev",
} as const;

export const CARGO_PATTERNS = {
  INLINE_GIT_OR_PATH: /\b(?:git|path)\s*=/,
  INLINE_VERSION: /\bversion\s*=\s*"([^"]+)"/,
  PACKAGE_NAME: /^[a-zA-Z0-9_-]+$/,
  SECTION: /^\s*\[([^\]]+)\]\s*(?:#.*)?$/,
  SIMPLE_DEPENDENCY: /^(\s*)("[^"]+"|[A-Za-z0-9_-]+)(\s*=\s*)("([^"]*)")?(.*)$/,
} as const;

export type CargoSectionType = (typeof CARGO_SECTION_TYPES)[keyof typeof CARGO_SECTION_TYPES];
