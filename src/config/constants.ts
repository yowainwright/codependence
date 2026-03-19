export const CONFIG_FILES = [
  ".codependencerc",
  ".codependencerc.json",
  "package.json",
] as const;

export const CONFIG_FILE_NAMES = CONFIG_FILES as readonly string[];

export const VALID_LANGUAGES = ["nodejs", "python", "go"] as const;
export const VALID_LEVELS = ["patch", "minor", "major"] as const;
export const VALID_MODES = ["verbose", "precise"] as const;
export const KNOWN_FIELDS = [
  "codependencies",
  "permissive",
  "language",
  "files",
  "ignore",
  "level",
  "mode",
] as const;
