import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import { manifestOnlyResolution } from "../infra";

import {
  isSafeTerraformName,
  collectTerraform,
  updateStringLine,
  updateSourceRef,
  parseManifest,
  capabilities,
} from "./utils";

export class TerraformProvider implements DependencyProvider {
  readonly language = LANGUAGES.TERRAFORM;
  readonly capabilities = capabilities;

  getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("Terraform");
  }

  getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("Terraform");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const { updates } = collectTerraform(filePath, content);
    const lines = content.split("\n");
    updates.forEach(({ line, name, sourceRef }) => {
      const version = manifest.dependencies[name];
      if (!version) return;

      const currentLine = lines[line] || "";
      if (sourceRef) {
        lines[line] = updateSourceRef(currentLine, version);
        return;
      }

      lines[line] = updateStringLine(currentLine, version);
    });
    writeFileSync(filePath, lines.join("\n"));
  }

  validatePackageName(packageName: string): boolean {
    const trimmed = packageName.trim();
    if (trimmed !== packageName) return false;
    return isSafeTerraformName(trimmed);
  }
}
