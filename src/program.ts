import { program } from "commander";
import { cosmiconfigSync } from "cosmiconfig";
import ora from "ora";
import gradient from "gradient-string";
import inquirer from "inquirer";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { logger } from "./logger";
import { script } from "./scripts";
import {
  Options,
  ConfigResult,
  PackageJSON,
  CodependenceConfig,
} from "./types";

export async function action(options: Options = {}): Promise<void | Options> {
  // Configure logger based on CLI flags
  const loggerConfig = {
    level: options.verbose
      ? ("verbose" as const)
      : options.debug
        ? ("debug" as const)
        : ("info" as const),
    silent: options.quiet || false,
    structured: false,
  };
  logger.configure(loggerConfig);

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
    if (!updatedOptions.codependencies && !updatedOptions.permissive) {
      throw '"codependencies" is required (unless using permissive mode)';
    }
    const spinner = ora(
      `🤼‍♀️ ${gradient.teen(`codependence`)} wrestling...\n`,
    ).start();
    await script(updatedOptions);
    spinner.succeed(`🤼‍♀️ ${gradient.teen(`codependence`)} pinned!`);
  } catch (err) {
    logger.error((err as string).toString(), undefined, "cli:error");
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
    const hasPackageJsonConfig = (() => {
      if (!existsSync(packageJsonPath)) return false;
      try {
        const content = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(content);
        return !!packageJson.codependence;
      } catch {
        return false;
      }
    })();

    if (hasConfig || hasPackageJsonConfig) {
      spinner.stop();
      logger.warn(
        "Codependence configuration already exists. Skipping initialization.",
        "init",
      );
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

    spinner.stop();

    console.log(`\n🤼‍♀️ Welcome to ${gradient.teen("Codependence")} setup!\n`);
    console.log(
      "Codependence helps you manage dependency versions in your project.\n",
    );

    let pinnedDeps: string[] = [];
    let outputType: "rc" | "package" = "rc";
    let usePermissive = true;

    if (type) {
      pinnedDeps = Object.keys(allDeps);
      outputType = type === "package" ? "package" : "rc";
      usePermissive = false;
    } else {
      const { managementMode } = await inquirer.prompt([
        {
          type: "list",
          name: "managementMode",
          message: "How would you like to manage your dependencies?",
          choices: [
            {
              name: "🚀 Permissive mode (recommended) - Update all dependencies to latest, except those you want to pin",
              value: "permissive",
            },
            {
              name: "🔒 Pin all dependencies - Keep all dependencies at their current versions",
              value: "all",
            },
          ],
          default: "permissive",
        },
      ]);

      if (managementMode === "permissive") {
        usePermissive = true;
        console.log(
          "\n📝 In permissive mode, you'll select dependencies to PIN (keep at current version).",
        );
        console.log(
          "   All other dependencies will be updated to their latest versions.\n",
        );

        const { pinnedDeps: userPinnedDeps } = await inquirer.prompt([
          {
            type: "checkbox",
            name: "pinnedDeps",
            message:
              "Select dependencies to PIN at their current versions (others will update to latest):",
            choices: Object.keys(allDeps).map((dep) => ({
              name: `${dep} (currently: ${allDeps[dep]})`,
              value: dep,
            })),
          },
        ]);
        pinnedDeps = userPinnedDeps;

        if (pinnedDeps.length === 0) {
          console.log(
            "\n✅ Great! All dependencies will be updated to latest versions.",
          );
        }
      } else {
        // Pin all dependencies mode
        usePermissive = false;
        pinnedDeps = Object.keys(allDeps);
        console.log(
          "\n🔒 All dependencies will be pinned at their current versions.",
        );
      }

      if (pinnedDeps.length > 0 || managementMode === "permissive") {
        const { outputLocation } = await inquirer.prompt([
          {
            type: "list",
            name: "outputLocation",
            message: "Where would you like to save the configuration?",
            choices: [
              { name: ".codependencerc (recommended)", value: "rc" },
              { name: "package.json", value: "package" },
            ],
            default: "rc",
          },
        ]);
        outputType = outputLocation;
      }
    }

    if (pinnedDeps.length === 0 && !usePermissive) {
      logger.info("No dependencies selected. Skipping initialization.", "init");
      return;
    }

    const config: CodependenceConfig = {
      ...(pinnedDeps.length > 0 ? { codependencies: pinnedDeps } : {}),
      ...(usePermissive ? { permissive: true } : {}),
    };

    const spinner2 = ora("Creating configuration...").start();

    if (outputType === "package") {
      const updatedPackageJson = {
        ...packageJson,
        codependence: config,
      };
      writeFileSync(
        packageJsonPath,
        JSON.stringify(updatedPackageJson, null, 2),
      );
      spinner2.succeed("Added codependence configuration to package.json");
    } else {
      writeFileSync(rcPath, JSON.stringify(config, null, 2));
      spinner2.succeed("Created .codependencerc configuration file");
    }

    console.log(`\n🎉 ${gradient.teen("Codependence")} setup complete!\n`);

    if (usePermissive) {
      console.log("📋 Next steps:");
      console.log("   • Run `codependence --update` to update dependencies");
      if (pinnedDeps.length > 0) {
        console.log(
          `   • These dependencies will stay pinned: ${pinnedDeps.join(", ")}`,
        );
      }
      console.log(
        "   • All other dependencies will update to latest versions\n",
      );
    } else {
      console.log("📋 Next steps:");
      console.log("   • Run `codependence` to check dependency versions");
      console.log("   • Run `codependence --update` to update dependencies\n");
    }
  } catch (err) {
    spinner.stop();
    logger.error(
      (err as Error).message || (err as string).toString(),
      undefined,
      "cli:error",
    );
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
  .option("-v, --verbose", "enable verbose logging (shows debug info)")
  .option("-q, --quiet", "suppress all output except errors")
  .option("--cds, --codependencies [codependencies...]", "deps to check")
  .option("-c, --config <config>", "path to a config file")
  .option("-s, --searchPath <searchPath>", "path to do a config file search")
  .option("-y, --yarnConfig", "enable yarn config support")
  .option(
    "--permissive",
    "update all deps to latest except those in codependencies",
  )
  .action(async (options: Options) => {
    await action(options);
  });

program
  .command("init [type]")
  .description(
    "Initialize codependence configuration with permissive mode by default",
  )
  .addHelpText(
    "after",
    `
    Interactive mode (recommended):
      - Sets up permissive mode by default (update all to latest, pin specific ones)
      - Allows you to choose which dependencies to pin
      - Creates .codependencerc or updates package.json

    Non-interactive types (legacy):
      rc          Create .codependencerc file with all dependencies pinned
      package     Add configuration to package.json with all dependencies pinned
      default     Create .codependencerc with all dependencies pinned (same as rc)
  `,
  )
  .action(initAction);

program.parse(process.argv);

export { program };
