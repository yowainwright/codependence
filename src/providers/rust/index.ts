import { readFileSync, writeFileSync } from "fs";
import { exec } from "../../utils/process";
import { LANGUAGES } from "../constants";
import type {
  CargoSectionTarget,
  DependencyManifest,
  DependencyProvider,
  ProviderOptions,
} from "../types";
import { CARGO_PACKAGE_MANAGER } from "./constants";

import {
  isCargoPackageName,
  readLatestCargoVersion,
  updateCargoManifestLine,
  parseManifest,
  capabilities,
} from "./utils";
export { normalizeCargoPackageName, updateCargoDependencyLine } from "./utils";

export class RustProvider implements DependencyProvider {
  readonly language = LANGUAGES.RUST;
  readonly capabilities = capabilities;

  constructor(_options: ProviderOptions = {}) {}

  normalizePackageName(packageName: string): string {
    return packageName.replaceAll("_", "-");
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const args = ["search", packageName, "--limit", "1"];
    const result = await exec(CARGO_PACKAGE_MANAGER, args);
    const latestVersion = readLatestCargoVersion(result.stdout, packageName);
    return latestVersion;
  }

  getAllVersions(_packageName: string): Promise<string[]> {
    return Promise.resolve([]);
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updated = content.split("\n").reduce(
      (state, line) => {
        const result = updateCargoManifestLine(line, state.currentSection, manifest);
        return {
          currentSection: result.currentSection,
          lines: state.lines.concat(result.line),
        };
      },
      { currentSection: null as CargoSectionTarget | null, lines: [] as string[] },
    );

    writeFileSync(filePath, updated.lines.join("\n"));
  }

  validatePackageName(packageName: string): boolean {
    const isValid = isCargoPackageName(packageName);
    return isValid;
  }
}
