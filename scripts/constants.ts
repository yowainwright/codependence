import type { PreRelease } from "./types";

export const TAG_VERSION_PATTERN =
  /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
export const RELEASE_VERSION_PATTERN =
  /\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?/g;
export const PRE_RELEASES = new Set<PreRelease>(["alpha", "beta", "rc"]);
export const SAFE_SHELL_ARG_PATTERN = /^[A-Za-z0-9_./:=@-]+$/;

export const BIN_OUTPUT_DIR = "artifacts";
export const BIN_OUTPUT_FILE = `${BIN_OUTPUT_DIR}/codependence`;
export const BIN_BUILD_ARGS = [
  "compile",
  "src/bin/index.ts",
  "-o",
  BIN_OUTPUT_FILE,
  "--quiet",
];
