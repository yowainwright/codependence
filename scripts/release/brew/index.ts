import { logger } from "../../../src/logger";
import type { BrewCliOptions } from "./types";
import {
  createLocalFormulaFromEnv,
  createPublishedFormula,
  requiredEnv,
  validateStableVersion,
} from "./utils";

export * from "./utils";
export type * from "./types";

export const runBrewCli = async ({
  argv = process.argv.slice(2),
  env = process.env,
}: BrewCliOptions = {}): Promise<void> => {
  const command = argv[0] ?? "generate";
  const version = requiredEnv(env, "VERSION");
  validateStableVersion(version);
  if (command === "validate-version") return;
  if (command === "generate-local") return createLocalFormulaFromEnv(env, version);
  if (command !== "generate") throw new Error(`Unknown command: ${command}`);
  const outputPath = requiredEnv(env, "FORMULA_PATH");
  await createPublishedFormula({ outputPath, version });
};

if (import.meta.main) {
  runBrewCli().catch((error) => {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
