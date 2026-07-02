import { readFileSync, writeFileSync } from "fs";
import { validatePackageName } from "../../utils/validate-package";
import { exec } from "../../utils/exec";
import { LANGUAGES, NODE_PACKAGE_MANAGERS } from "../constants";
import type {
  DependencyProvider,
  DependencyManifest,
  ProviderOptions,
} from "../types";

export class NodeJSProvider implements DependencyProvider {
  readonly language = LANGUAGES.NODEJS;
  readonly capabilities = {
    supportsLatestResolution: true,
    supportsPreciseMode: true,
    versionStrategy: "semver",
  } as const;
  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const packageManager = this.options.packageManager;
    const shouldUseYarn =
      packageManager === NODE_PACKAGE_MANAGERS.YARN ||
      this.options.yarnConfig === true;

    if (shouldUseYarn) {
      return this.getYarnVersion(packageName);
    }

    return this.getNpmVersion(packageName);
  }

  private async getNpmVersion(packageName: string): Promise<string> {
    const { stdout } = await exec(NODE_PACKAGE_MANAGERS.NPM, [
      "view",
      packageName,
      "version",
      "latest",
    ]);
    return stdout.replace("\n", "");
  }

  private async getYarnVersion(packageName: string): Promise<string> {
    const { stdout } = await exec(NODE_PACKAGE_MANAGERS.YARN, [
      NODE_PACKAGE_MANAGERS.NPM,
      "info",
      packageName,
      "--fields",
      "version",
      "--json",
    ]);
    const parsed = JSON.parse(stdout.replace("\n", ""));
    return parsed?.version || "";
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const { stdout } = await exec(NODE_PACKAGE_MANAGERS.NPM, [
      "view",
      packageName,
      "versions",
      "--json",
    ]);
    return JSON.parse(stdout);
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const json = JSON.parse(content);

    return {
      filePath,
      name: json.name,
      version: json.version,
      dependencies: json.dependencies || {},
      devDependencies: json.devDependencies || {},
      peerDependencies: json.peerDependencies || {},
      optionalDependencies: json.optionalDependencies || {},
    };
  }

  writeManifest(
    filePath: string,
    manifest: DependencyManifest,
  ): void {
    const content = readFileSync(filePath, "utf8");
    const json = JSON.parse(content);

    json.dependencies = manifest.dependencies;
    json.devDependencies = manifest.devDependencies;
    json.peerDependencies = manifest.peerDependencies;
    json.optionalDependencies = manifest.optionalDependencies;

    writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n");
  }

  validatePackageName(packageName: string): boolean {
    const { validForNewPackages, validForOldPackages } =
      validatePackageName(packageName);
    return validForNewPackages || validForOldPackages;
  }
}
