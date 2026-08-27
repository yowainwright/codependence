import type { PreRelease, ReleaseIncrement } from "./types";

export const TAG_VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
export const RELEASE_VERSION_PATTERN = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/g;
export const STABLE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
export const PRE_RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+(?:\+[0-9A-Za-z.-]+)?$/;
export const PRE_RELEASES = new Set<PreRelease>(["alpha", "beta", "rc"]);
export const RELEASE_INCREMENTS = new Set<ReleaseIncrement>(["patch", "minor", "major"]);
export const SAFE_SHELL_ARG_PATTERN = /^[A-Za-z0-9_./:=@-]+$/;
export const DEFAULT_RELEASE_TIMEOUT_MINUTES = 90;
export const RELEASE_POLL_INTERVAL_MS = 30_000;
export const RELEASE_REPOSITORY = "yowainwright/codependence";
export const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
export const REMOVED_VERSION_LINE_PATTERN = /^-\s*"version":\s*"[^"]+",\s*$/;
export const CONFIG_SCHEMA_PATH = "src/config/schema.json";
export const PACKAGE_JSON_PATH = "package.json";
export const PACKAGE_RELEASE_FILES = [PACKAGE_JSON_PATH];
export const RELEASE_FILES = [CONFIG_SCHEMA_PATH, PACKAGE_JSON_PATH].sort();
export const SCHEMA_REVISION_LINE_PATTERN = /^[+-]\s*"x-revision":/;
export const SCHEMA_UPDATED_LINE_PATTERN = /^[+-]\s*"x-updated":/;
export const REMOVED_SCHEMA_REVISION_LINE_PATTERN =
  /^-\s*"x-revision":\s*(?:"[^"]+"|\d+),?\s*$/;
export const ADDED_SCHEMA_REVISION_LINE_PATTERN =
  /^\+\s*"x-revision":\s*"([^"]+)",?\s*$/;
export const REMOVED_SCHEMA_UPDATED_LINE_PATTERN =
  /^-\s*"x-updated":\s*"\d{4}-\d{2}-\d{2}",?\s*$/;
export const ADDED_SCHEMA_UPDATED_LINE_PATTERN =
  /^\+\s*"x-updated":\s*"\d{4}-\d{2}-\d{2}",?\s*$/;
