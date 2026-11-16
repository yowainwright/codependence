import type { DependencyManifest } from "../types";
import { appendDependencyVersion, emptyInfraManifest, readYamlImageLine } from "../infra/utils";

export const capabilities = {
  supportsLatestResolution: false,
  supportsPreciseMode: false,
  versionStrategy: "exact",
} as const;

export const parseManifest = (filePath: string, content: string): DependencyManifest => {
  const manifest = emptyInfraManifest(filePath);
  content.split("\n").forEach((line) => {
    const image = readYamlImageLine(line);
    if (image) appendDependencyVersion(manifest, image.name, image.version);
  });
  return manifest;
};
