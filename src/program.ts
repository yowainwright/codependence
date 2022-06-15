#!/usr/bin/env node

import { program } from "commander";
import { cosmiconfigSync } from "cosmiconfig";
import gradient from "gradient-string";
import { script } from "./scripts";
import { DEBUG_NAME } from "./constants";
import { Options } from "./types";

const explorer = cosmiconfigSync("codependency");

export async function action(options: Options = {}): Promise<void> {
  try {
    const { config = {} } = explorer.search() || {};
    if (options?.isTestingCLI) console.info({ config, options });
    const updatedOptions = { ...config, ...options, isCLI: true };
    if (!updatedOptions?.codeDependencies)
      throw '"codeDependencies" is required';
    await script(updatedOptions);
  } catch (err) {
    console.error(gradient.passion(`${DEBUG_NAME}:cli:err`));
  }
}

program
  .description(
    "Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date"
  )
  .option("-t, --isTestingCLI", "enables CLI testing, no scripts are run")
  .option("-f, --files", "file glob pattern")
  .option("-u, --update", "update dependencies based on check")
  .option("-r, --rootDir", "root directory to start search")
  .option("-i, --ignore", "ignore glob pattern")
  .option("--debug", "enable debugging")
  .option("--silent", "enable mainly silent logging")
  .option(
    "-c, --codependencies",
    "a path to a file with a codependenies object"
  )
  .action(action)
  .parse(process.argv);

export default program;
