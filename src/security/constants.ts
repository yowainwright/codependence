import { LANGUAGES } from "../providers/constants";
import type { SupportedLanguage } from "../types";

export const OSV_API_URL = "https://api.osv.dev/v1";
export const OSV_BATCH_LIMIT = 1000;
export const OSV_CONCURRENCY = 8;
export const OSV_BATCH_CONCURRENCY = 2;
export const OSV_TIMEOUT_MS = 10000;

export const OSV_ECOSYSTEMS: Partial<Record<SupportedLanguage, string>> = {
  [LANGUAGES.GO]: "Go",
  [LANGUAGES.NODEJS]: "npm",
  [LANGUAGES.PYTHON]: "PyPI",
  [LANGUAGES.RUST]: "crates.io",
};

export const OSV_SEVERITIES = new Set(["low", "moderate", "high", "critical"]);
export const QUERYABLE_VERSION = /^v?\d[\w.+-]*$/;

export const DEFAULT_PRERELEASE_RANK = 3;
export const PRERELEASE_RANKS: Record<string, number> = {
  dev: 0,
  a: 1,
  alpha: 1,
  b: 2,
  beta: 2,
  c: 3,
  rc: 3,
  pre: 3,
  preview: 3,
};

export const NUMERIC_TOKEN = /^\d+$/;
export const POST_RELEASE_TAG = /^(post|rev|r)$/i;
