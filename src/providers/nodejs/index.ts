import { readFileSync, writeFileSync } from "fs";
import { validatePackageName } from "../../utils/validate-package";
import { exec } from "../../utils/exec";
import type {
  DependencyProvider,
  DependencyManifest,
  ProviderOptions,
} from "../types";

export class NodeJSProvider implements DependencyProvider {
  readonly language = "nodejs" as const;
  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const isYarnConfig = this.options.yarnConfig || false;

    if (isYarnConfig) {
      return this.getYarnVersion(packageName);
    }

    return this.getNpmVersion(packageName);
  }

  private async getNpmVersion(packageName: string): Promise<string> {
    const { stdout } = await exec("npm", [
      "view",
      packageName,
      "version",
      "latest",
    ]);
    return stdout.replace("\n", "");
  }

  private async getYarnVersion(packageName: string): Promise<string> {
    const { stdout } = await exec("yarn", [
      "npm",
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
    const { stdout } = await exec("npm", [
      "view",
      packageName,
      "versions",
      "--json",
    ]);
    return JSON.parse(stdout);
  }

  async readManifest(filePath: string): Promise<DependencyManifest> {
    const content = readFileSync(filePath, "utf8");
    const json = JSON.parse(content);

    return {
      filePath,
      name: json.name,
      version: json.version,
      dependencies: json.dependencies || {},
      devDependencies: json.devDependencies || {},
      peerDependencies: json.peerDependencies || {},
    };
  }

  async writeManifest(
    filePath: string,
    manifest: DependencyManifest,
  ): Promise<void> {
    const content = readFileSync(filePath, "utf8");
    const json = JSON.parse(content);

    json.dependencies = manifest.dependencies;
    json.devDependencies = manifest.devDependencies;
    json.peerDependencies = manifest.peerDependencies;

    writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n");
  }

  validatePackageName(packageName: string): boolean {
    const { validForNewPackages, validForOldPackages } =
      validatePackageName(packageName);
    return validForNewPackages || validForOldPackages;
  }
}
