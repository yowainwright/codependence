import { LANGUAGES, MANIFEST_FILES } from "../providers/constants";

export const CONFIG_FILES = [
  ".codependencerc",
  ".codependencerc.json",
  ".codependencerc.yaml",
  ".codependencerc.yml",
  MANIFEST_FILES.PACKAGE_JSON,
] as const;

export const CONFIG_FILE_NAMES = CONFIG_FILES as readonly string[];

export const VALID_LANGUAGES = [
  LANGUAGES.NODEJS,
  LANGUAGES.PYTHON,
  LANGUAGES.GO,
] as const;
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
