import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import {
  appendDependencyVersion,
  emptyInfraManifest,
  isSafeImageName,
  manifestOnlyResolution,
  readYamlImageLine,
  updateYamlImageLine,
} from "../infra";

export class KubernetesProvider implements DependencyProvider {
  readonly language = LANGUAGES.KUBERNETES;
  readonly capabilities = {
    supportsLatestResolution: false,
    supportsPreciseMode: false,
    versionStrategy: "exact",
  } as const;

  async getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("Kubernetes");
  }

  async getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("Kubernetes");
  }

  readManifest(filePath: string): DependencyManifest {
    const manifest = emptyInfraManifest(filePath);
    readFileSync(filePath, "utf8")
      .split("\n")
      .forEach((line) => {
        const image = readYamlImageLine(line);
        if (image) appendDependencyVersion(manifest, image.name, image.version);
      });
    return manifest;
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

  validatePackageName(packageName: string): boolean {
    return isSafeImageName(packageName);
  }
}
