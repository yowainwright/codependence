import { readFileSync, writeFileSync } from "fs";

import { manifestOnlyResolution } from "../infra";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import { HELM_PATTERNS } from "./constants";

import {
  updateHelmManifest,
  isChartManifest,
  updateHelmValuesManifest,
  parseManifest,
  capabilities,
} from "./utils";

export class HelmProvider implements DependencyProvider {
  readonly language = LANGUAGES.HELM;
  readonly capabilities = capabilities;

  getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("Helm");
  }

  getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("Helm");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updated = isChartManifest(filePath)
      ? updateHelmManifest(content, manifest.dependencies)
      : updateHelmValuesManifest(filePath, content, manifest);
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const trimmed = packageName.trim();
    if (trimmed !== packageName) return false;

    return HELM_PATTERNS.PACKAGE_NAME.test(trimmed);
  }
}
