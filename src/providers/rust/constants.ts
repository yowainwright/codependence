export const CARGO_PACKAGE_MANAGER = "cargo";

export const CARGO_SECTION_TYPES = {
  BUILD: "build",
  DEPENDENCY: "dependency",
  DEV: "dev",
} as const;

export const CARGO_PATTERNS = {
  SECTION: /^\s*\[([^\]]+)\]\s*$/,
  SIMPLE_DEPENDENCY:
    /^(\s*)("?)([A-Za-z0-9_-]+)\2(\s*=\s*)("([^"]+)"|\{[^}]*\})(.*)$/,
  INLINE_VERSION: /version\s*=\s*"([^"]+)"/,
  INLINE_PACKAGE: /package\s*=\s*"([^"]+)"/,
  INLINE_GIT_OR_PATH: /\b(git|path)\s*=/,
  PACKAGE_NAME: /^[A-Za-z0-9_-]+$/,
} as const;

export type CargoSectionType =
  (typeof CARGO_SECTION_TYPES)[keyof typeof CARGO_SECTION_TYPES];
