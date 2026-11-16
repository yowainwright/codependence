import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import {
  isSafeImageName,
  manifestOnlyResolution,
  readYamlScalar,
  updateScalarLine,
} from "../infra";

import { collectImages, parseManifest, capabilities } from "./utils";

export class KustomizeProvider implements DependencyProvider {
  readonly language = LANGUAGES.KUSTOMIZE;
  readonly capabilities = capabilities;

  getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("Kustomize");
  }

  getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("Kustomize");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const { updates } = collectImages(filePath, content);
    const lines = content.split("\n");
    updates.forEach(({ line, name }) => {
      const current = readYamlScalar(lines[line] || "");
      if (!current) return;

      const next = manifest.dependencies[name];
      if (next) lines[line] = updateScalarLine(lines[line], next);
    });
    writeFileSync(filePath, lines.join("\n"));
  }

  validatePackageName = isSafeImageName;
}
