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
  LANGUAGES.RUST,
  LANGUAGES.DOCKER,
  LANGUAGES.GITHUB_ACTIONS,
] as const;
export const VALID_LEVELS = ["patch", "minor", "major"] as const;
export const VALID_MODES = ["verbose", "precise"] as const;
export const VALID_FORMATS = ["json", "markdown", "table"] as const;
export const KNOWN_FIELDS = [
  "codependencies",
  "permissive",
  "language",
  "files",
  "ignore",
  "level",
  "mode",
  "rootDir",
  "update",
  "debug",
  "silent",
  "verbose",
  "quiet",
  "yarnConfig",
  "dryRun",
  "interactive",
  "watch",
  "noCache",
  "format",
  "outputFile",
] as const;
