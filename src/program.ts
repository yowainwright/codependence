import { readFileSync, writeFileSync, existsSync } from "fs";
import { logger } from "./logger";
import { script } from "./scripts";
import { createSpinner } from "./utils/spinner";
import { cyan, bold } from "./utils/colors";
import { Prompt } from "./utils/prompts";
import { loadConfig } from "./utils/config";
import { parseArgs, showHelp } from "./cli/parser";
import { Options, PackageJSON, CodependenceConfig } from "./types";

const gradient = (text: string) => bold(cyan(text));

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
  const result = loadConfig(undefined, options?.searchPath);
  const configFileResult = options?.config ? loadConfig(options.config) : null;
  const pathConfig = configFileResult?.config || {};

  // massage config and option data
  const hasPathConfig = Object.keys(pathConfig).length > 0;
  const baseConfig = hasPathConfig ? {} : result?.config || {};
  const hasCodependenceKey =
    pathConfig?.codependence !== undefined &&
    typeof pathConfig.codependence === "object" &&
    pathConfig.codependence !== null;
  const normalizedPathConfig = hasCodependenceKey
    ? (pathConfig.codependence as Record<string, unknown>)
    : pathConfig;

  const updatedConfig = {
    ...baseConfig,
    ...normalizedPathConfig,
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
    const spinner = createSpinner(
      `🤼‍♀️ ${gradient(`codependence`)} wrestling...\n`,
    ).start();
    await script(updatedOptions);
    spinner.succeed(`🤼‍♀️ ${gradient(`codependence`)} pinned!`);
  } catch (err) {
    logger.error((err as string).toString(), undefined, "cli:error");
  }
}

export async function initAction(
  type?: "rc" | "package" | "default",
): Promise<void> {
  const spinner = createSpinner(
    `🤼‍♀️ ${gradient(`codependence`)} initializing...\n`,
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

    console.log(`\n🤼‍♀️ Welcome to ${gradient("Codependence")} setup!\n`);
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
      const prompt = new Prompt();
      const managementMode = await prompt.list(
        "How would you like to manage your dependencies?",
        [
          {
            name: "🚀 Permissive mode (recommended) - Update all dependencies to latest, except those you want to pin",
            value: "permissive",
          },
          {
            name: "🔒 Pin all dependencies - Keep all dependencies at their current versions",
            value: "all",
          },
        ],
      );

      if (managementMode === "permissive") {
        usePermissive = true;
        console.log(
          "\n📝 In permissive mode, you'll select dependencies to PIN (keep at current version).",
        );
        console.log(
          "   All other dependencies will be updated to their latest versions.\n",
        );

        const userPinnedDeps = await prompt.checkbox(
          "Select dependencies to PIN at their current versions (others will update to latest):",
          Object.keys(allDeps).map((dep) => ({
            name: `${dep} (currently: ${allDeps[dep]})`,
            value: dep,
          })),
        );
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

      const shouldPromptForOutput =
        pinnedDeps.length > 0 || managementMode === "permissive";
      if (shouldPromptForOutput) {
        const outputLocation = await prompt.list(
          "Where would you like to save the configuration?",
          [
            { name: ".codependencerc (recommended)", value: "rc" },
            { name: "package.json", value: "package" },
          ],
        );
        outputType = outputLocation as "rc" | "package";
      }

      prompt.close();
    }

    const hasNoDepsAndNotPermissive = pinnedDeps.length === 0 && !usePermissive;
    if (hasNoDepsAndNotPermissive) {
      logger.info("No dependencies selected. Skipping initialization.", "init");
      return;
    }

    const hasPinnedDeps = pinnedDeps.length > 0;
    const codependenciesConfig = hasPinnedDeps
      ? { codependencies: pinnedDeps }
      : {};
    const permissiveConfig = usePermissive ? { permissive: true } : {};

    const config: CodependenceConfig = {
      ...codependenciesConfig,
      ...permissiveConfig,
    };

    const spinner2 = createSpinner("Creating configuration...").start();

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

    console.log(`\n🎉 ${gradient("Codependence")} setup complete!\n`);

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

export async function run(args: string[] = process.argv): Promise<void> {
  const parsed = parseArgs(args);

  const isHelpRequested = parsed.options.help === true;
  if (isHelpRequested) {
    showHelp();
    return;
  }

  const isInitCommand = parsed.command === "init";
  if (isInitCommand) {
    const initType = args.find(
      (arg) => arg === "rc" || arg === "package" || arg === "default",
    ) as "rc" | "package" | "default" | undefined;
    await initAction(initType);
    return;
  }

  await action(parsed.options as Options);
}

const isMainModule = require.main === module;
if (isMainModule) {
  run().catch((err) => {
    logger.error(err.message || err.toString(), undefined, "cli:error");
    process.exit(1);
  });
}
