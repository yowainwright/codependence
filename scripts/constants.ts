import type { PreRelease, ReleaseIncrement } from "./types";

export const TAG_VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
export const RELEASE_VERSION_PATTERN = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/g;
export const STABLE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
export const PRE_RELEASES = new Set<PreRelease>(["alpha", "beta", "rc"]);
export const RELEASE_INCREMENTS = new Set<ReleaseIncrement>(["patch", "minor", "major"]);
export const SAFE_SHELL_ARG_PATTERN = /^[A-Za-z0-9_./:=@-]+$/;
export const DEFAULT_RELEASE_TIMEOUT_MINUTES = 90;
export const RELEASE_POLL_INTERVAL_MS = 30_000;

export const BIN_OUTPUT_DIR = "artifacts";
export const BIN_OUTPUT_FILE = `${BIN_OUTPUT_DIR}/codependence`;
export const BIN_ENTRY_SOURCE_FILE = "scripts/bin/entry.ts";
export const BIN_ENTRY_FILE = `${BIN_OUTPUT_DIR}/entry.ts`;
export const BIN_RUNTIME_NAME = "codependence-runtime";
export const BIN_RUNTIME_SOURCE_FILE = "src/bin/index.ts";
export const BIN_RUNTIME_DIR = `${BIN_OUTPUT_DIR}/node_modules/${BIN_RUNTIME_NAME}`;
export const BIN_RUNTIME_PACKAGE_FILE = `${BIN_RUNTIME_DIR}/package.json`;
export const BIN_RUNTIME_TYPES_FILE = `${BIN_RUNTIME_DIR}/index.d.ts`;
export const BIN_BUNDLE_FILE = `${BIN_RUNTIME_DIR}/index.js`;
export const BIN_BUNDLE_ARGS = [
  BIN_RUNTIME_SOURCE_FILE,
  "--file",
  BIN_BUNDLE_FILE,
  "--format",
  "esm",
  "--platform",
  "node",
  "--minify",
];
export const BIN_BUILD_ARGS = [
  "build",
  BIN_ENTRY_FILE,
  "-o",
  BIN_OUTPUT_FILE,
  "--dynamic",
  "--no-keep-c",
];
