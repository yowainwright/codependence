import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import { isSafeImageName, manifestOnlyResolution, updateYamlImageLine } from "../infra";

import { parseManifest, capabilities } from "./utils";

export class KubernetesProvider implements DependencyProvider {
  readonly language = LANGUAGES.KUBERNETES;
  readonly capabilities = capabilities;

  getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("Kubernetes");
  }

  getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("Kubernetes");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const output = readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) =>
        updateYamlImageLine(line, manifest.dependencies, manifest.resolvedDependencyVersions),
      )
      .join("\n");
    writeFileSync(filePath, output);
  }

  validatePackageName = isSafeImageName;
}
