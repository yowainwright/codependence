import { logger } from "../../../src/observability";
import type { BrewCliOptions } from "./types";
import {
  createLocalFormulaFromEnv,
  createPublishedFormula,
  requiredEnv,
  validateStableVersion,
  writeHomebrewReleaseState,
  writeHomebrewTapUpdate,
} from "./utils";

export * from "./utils";
export type * from "./types";

export const runBrewCli = async ({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl,
}: BrewCliOptions = {}): Promise<void> => {
  const command = argv[0] ?? "generate";
  const version = requiredEnv(env, "VERSION");
  validateStableVersion(version);
  if (command === "validate-version") return;
  if (command === "check-state") return writeHomebrewReleaseState({ env, fetchImpl });
  if (command === "update-tap") return writeHomebrewTapUpdate({ env, fetchImpl });
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
