export const CLI_ERROR_EXIT_CODE = 2;
export const INIT_TYPES = ["rc", "package", "default"] as const;
export const INTERNAL_OPTION_FIELDS = new Set(["isCLI", "isTesting"]);
export const TARGET_OVERRIDE_FIELDS = [
  "codependencies",
  "files",
  "ignore",
  "language",
  "level",
  "mode",
  "permissive",
  "rootDir",
  "yarnConfig",
] as const;
