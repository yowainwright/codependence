#!/usr/bin/env node
import { run } from "./program";
import { script } from "./scripts";
import { logger } from "./logger";

run().catch((err) => {
  logger.error(err.message || err.toString(), undefined, "cli:error");
  process.exit(1);
});

export { script };
