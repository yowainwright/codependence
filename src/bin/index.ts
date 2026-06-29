import { logger } from "../logger";
import { run } from "../program";
import type { BinaryArgv } from "./types";

const BINARY_SCRIPT_NAME = "codependence";
const KNOWN_COMMANDS = new Set(["init"]);

export const normalizeBinaryArgv = (argv: BinaryArgv): string[] => {
  const firstArg = argv[0] || BINARY_SCRIPT_NAME;
  const secondArg = argv[1];
  const hasDuplicateExecutable = secondArg === firstArg;

  if (hasDuplicateExecutable) {
    return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(2)];
  }

  const hasOptionAsSecondArg = secondArg?.startsWith("-") === true;
  const hasCommandAsSecondArg = secondArg !== undefined && KNOWN_COMMANDS.has(secondArg);
  const needsScriptArg = secondArg === undefined || hasOptionAsSecondArg || hasCommandAsSecondArg;

  if (needsScriptArg) {
    return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(1)];
  }

  return [...argv];
};

run(normalizeBinaryArgv(process.argv)).catch((err) => {
  logger.error(err.message || err.toString());
  process.exit(2);
});
