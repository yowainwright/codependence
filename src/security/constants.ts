import { LANGUAGES } from "../providers/constants";
import type { SupportedLanguage } from "../types";

export const OSV_API_URL = "https://api.osv.dev/v1";
export const OSV_BATCH_LIMIT = 1000;
export const OSV_CONCURRENCY = 8;
export const OSV_TIMEOUT_MS = 10000;

export const OSV_ECOSYSTEMS: Partial<Record<SupportedLanguage, string>> = {
  [LANGUAGES.GO]: "Go",
  [LANGUAGES.NODEJS]: "npm",
  [LANGUAGES.PYTHON]: "PyPI",
  [LANGUAGES.RUST]: "crates.io",
};

export const OSV_SEVERITIES = new Set(["low", "moderate", "high", "critical"]);
export const QUERYABLE_VERSION = /^v?\d[\w.+-]*$/;
