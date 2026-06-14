#!/usr/bin/env node
import { logger } from "./logger";
import { run } from "./program";

run().catch((err) => {
  logger.error(err.message || err.toString());
  process.exit(2);
});
