#!/usr/bin/env node

import { program } from "commander";
import { cosmiconfigSync } from "cosmiconfig";
import { Options } from "./types";
import script from "./scripts";

const explorer = cosmiconfigSync("codependency");

export async function action(options: Options = {}): Promise<void> {
  try {
    const { config = {} } = explorer.search() || {};
    if (options?.isTestingCLI) console.info({ config, options });
    const {
      codependencies,
      rootDir = "./",
      files = "**/package.json",
      ignore = ["node_modules/**/*", "**/node_modules/**/*"],
      update = false,
      debug = false,
      silent = false,
      addDeps = false,
      install = false,
    } = options;
    script({ rootDir, files, ignore, update, debug });
  } catch (err) {
    console.error(err);
  }
}

program
  .description(
    "Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date"
  )
  .option("-t, --isTestingCLI", "enables CLI testing, no scripts are run")
  .option("-f, --files", "file glob pattern")
  .option("-u, --update", "update dependencies based on check")
  .option("-r, --root", "root directory to start search")
  .option("-i, --ignore", "ignore glob pattern")
  .option("--debug", "enable debugging")
  .option("--silent", "enable mainly silent logging")
  .option("--addDeps", "add codependents as dependencies")
  .option("--install", "install codependents without saving")
  .option(
    "-c, --codependencies",
    "a path to a file with a codependenies object"
  )
  .action(action)
  .parse(process.argv);
