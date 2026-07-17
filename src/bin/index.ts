import { logger } from "../logger";
import { run } from "../program";
import { BINARY_SCRIPT_NAME, SCRIPT_PATH_EXTENSIONS } from "./constants";
import type { BinaryArgv } from "./types";

const hasPathSegment = (value: string): boolean => value.includes("/") || value.includes("\\");

const hasScriptExtension = (value: string): boolean =>
  SCRIPT_PATH_EXTENSIONS.some((extension) => value.endsWith(extension));

const isScriptPathArg = (value: string | undefined): boolean => {
  if (!value) return false;

  return hasPathSegment(value) || hasScriptExtension(value);
};

export const normalizeBinaryArgv = (argv: BinaryArgv): string[] => {
  const firstArg = argv[0] || BINARY_SCRIPT_NAME;
  const secondArg = argv[1];
  const hasDuplicateExecutable = secondArg === firstArg;

  if (hasDuplicateExecutable) {
    return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(2)];
  }

  const needsScriptArg = secondArg === undefined || !isScriptPathArg(secondArg);

  if (needsScriptArg) {
    return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(1)];
  }

  return [...argv];
};

run(normalizeBinaryArgv(process.argv)).catch((err) => {
  logger.error(err.message || err.toString());
  process.exit(2);
});
