import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import { manifestOnlyResolution } from "../infra";
import { CIRCLECI_PATTERNS } from "./constants";

import { updateCircleCILine, parseManifest, capabilities } from "./utils";

export class CircleCIProvider implements DependencyProvider {
  readonly language = LANGUAGES.CIRCLECI;
  readonly capabilities = capabilities;

  getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("CircleCI");
  }

  getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("CircleCI");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    let state = { inOrbs: false, orbsIndent: -1 };
    const lines = readFileSync(filePath, "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      const result = updateCircleCILine(state, line, manifest.dependencies);
      state = result.state;
      lines[index] = result.line;
    }
    const output = lines.join("\n");
    writeFileSync(filePath, output);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = CIRCLECI_PATTERNS.PACKAGE_NAME.test(packageName);
    return isValid;
  }
}
