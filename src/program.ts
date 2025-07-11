#!/usr/bin/env node

import { program } from "commander";
import { cosmiconfigSync } from "cosmiconfig";
import ora from "ora";
import gradient from "gradient-string";
import inquirer from "inquirer";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { logger } from "./scripts/utils";
import { script } from "./scripts/core";
import {
  Options,
  ConfigResult,
  PackageJSON,
  CodependenceConfig,
} from "./types";

export async function action(options: Options = {}): Promise<void> {
  // capture config data
  const explorer = cosmiconfigSync("codependence");
  const result = options?.searchPath
    ? explorer.search(options.searchPath)
    : explorer.search();
  const { config: pathConfig = {} } = (
    options?.config ? explorer.load(options?.config) : {}
  ) as ConfigResult;

  // massage config and option data
  const updatedConfig = {
    ...(!Object.keys(pathConfig).length ? result?.config : {}),
    ...(pathConfig?.codependence ? { ...pathConfig.codependence } : pathConfig),
    ...options,
    isCLI: true,
  };

  // remove action level options
  const {
    config: _usedConfig,
    searchPath: _usedSearchPath,
    isTestingCLI,
    isTestingAction,
    ...updatedOptions
  } = updatedConfig;

  // capture/test CLI options
  if (isTestingCLI) {
    console.info({ updatedOptions });
    return;
  }

  // capture action unit test options
  if (isTestingAction) return updatedOptions;

  try {
    if (!updatedOptions.codependencies) throw '"codependencies" is required';
    const spinner = ora(
      `🤼‍♀️ ${gradient.teen(`codependence`)} wrestling...\n`,
    ).start();
    await script(updatedOptions);
    spinner.succeed(`🤼‍♀️ ${gradient.teen(`codependence`)} pinned!`);
  } catch (err) {
    logger({
      type: "error",
      section: "cli:error",
      message: (err as string).toString(),
    });
  }
}

export async function initAction(
  type?: "rc" | "package" | "default",
): Promise<void> {
  const spinner = ora(
    `🤼‍♀️ ${gradient.teen(`codependence`)} initializing...\n`,
  ).start();

  try {
    const rcPath = ".codependencerc";
    const packageJsonPath = "package.json";
    const hasConfig = existsSync(rcPath);
    if (hasConfig) {
      spinner.stop();
      logger({
        type: "warn",
        section: "init",
        message: ".codependencerc already exists. Skipping initialization.",
      });
      return;
    }

    const hasPackageJson = existsSync(packageJsonPath);
    if (!hasPackageJson) {
      throw new Error("package.json not found in the current directory");
    }

    const content = readFileSync(packageJsonPath, "utf8");
    let packageJson: PackageJSON;
    try {
      packageJson = JSON.parse(content) as PackageJSON;
    } catch (parseError) {
      throw new Error(`Invalid JSON in package.json: ${parseError}`);
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    const hasDeps = Object.keys(allDeps).length > 0;
    if (!hasDeps) {
      throw new Error("No dependencies found in package.json");
    }

    let selectedDeps: string[] = [];
    let outputType: "rc" | "package" = "rc";

    if (type) {
      selectedDeps = Object.keys(allDeps);
      outputType = type === "package" ? "package" : "rc";
    } else {
      const { configType } = await inquirer.prompt([
        {
          type: "list",
          name: "configType",
          message: "How would you like to configure codependence?",
          choices: [
            { name: "Set specific dependencies to pin", value: "select" },
            { name: "Pin all dependencies", value: "all" },
          ],
        },
      ]);

      if (configType === "all") {
        selectedDeps = Object.keys(allDeps);
      } else {
        const { selectedDeps: userSelectedDeps } = await inquirer.prompt([
          {
            type: "checkbox",
            name: "selectedDeps",
            message: "Select dependencies to pin their versions:",
            choices: Object.keys(allDeps).map((dep) => ({
              name: `${dep} (${allDeps[dep]})`,
              value: dep,
            })),
          },
        ]);
        selectedDeps = userSelectedDeps;

        const { outputLocation } = await inquirer.prompt([
          {
            type: "list",
            name: "outputLocation",
            message: "Where would you like to save the configuration?",
            choices: [
              { name: ".codependencerc", value: "rc" },
              { name: "package.json", value: "package" },
            ],
          },
        ]);
        outputType = outputLocation;
      }
    }

    if (selectedDeps.length === 0) {
      spinner.stop();
      logger({
        type: "info",
        section: "init",
        message: "No dependencies selected. Skipping initialization.",
      });
      return;
    }

    const config: CodependenceConfig = {
      codependencies: selectedDeps,
    };

    if (outputType === "package") {
      const updatedPackageJson = {
        ...packageJson,
        codependence: config,
      };
      writeFileSync(
        packageJsonPath,
        JSON.stringify(updatedPackageJson, null, 2),
      );
      logger({
        type: "info",
        section: "init",
        message: "Added codependence configuration to package.json",
      });
    } else {
      writeFileSync(rcPath, JSON.stringify(config, null, 2));
      logger({
        type: "info",
        section: "init",
        message: `Created .codependencerc with ${selectedDeps.length === Object.keys(allDeps).length ? "all" : "selected"} dependencies`,
      });
    }

    spinner.succeed(`🤼‍♀️ ${gradient.teen(`codependence`)} initialized!`);
  } catch (err) {
    spinner.stop();
    logger({
      type: "error",
      section: "cli:error",
      message: (err as Error).message || (err as string).toString(),
    });
  }
}

program
  .description(
    "Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date",
  )
  .option("-t, --isTestingCLI", "enable CLI only testing")
  .option("--isTesting", "enable running fn tests w/o overwriting")
  .option("-f, --files [files...]", "file glob pattern")
  .option("-u, --update", "update dependencies based on check")
  .option("-r, --rootDir <rootDir>", "root directory to start search")
  .option("-i, --ignore [ignore...]", "ignore glob pattern")
  .option("--debug", "enable debugging")
  .option("--silent", "enable mainly silent logging")
  .option("--cds, --codependencies [codependencies...]", "deps to check")
  .option("-c, --config <config>", "path to a config file")
  .option("-s, --searchPath <searchPath>", "path to do a config file search")
  .option("-y, --yarnConfig", "enable yarn config support")
  .option(
    "--permissive",
    "update all deps to latest except those in codependencies",
  )
  .action(action);

program
  .command("init [type]")
  .description("Initialize codependence configuration interactively")
  .addHelpText(
    "after",
    `
    Non-interactive types:
      rc          Create .codependencerc file with all dependencies
      package     Add configuration to package.json with all dependencies
      default     Create .codependencerc with all dependencies (same as rc)
  `,
  )
  .action(initAction);

program.parse(process.argv);

export { program };
