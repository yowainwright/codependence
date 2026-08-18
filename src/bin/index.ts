import { logger } from "../logger";
import { run } from "../program";
import { normalizeBinaryArgv } from "./utils";
import type { BinaryArgv } from "./types";

export { configureBinaryHost } from "./utils";

export const runBinary = async (argv: BinaryArgv, runProgram: typeof run = run): Promise<void> => {
  try {
    await runProgram(normalizeBinaryArgv(argv));
  } catch (error) {
    const err = error as Error;
    logger.error(err.message || err.toString());
    process.exit(2);
  }
};
