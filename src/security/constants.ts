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

export const PYPI_ECOSYSTEM = "PyPI";
export const NUMERIC_IDENTIFIER = /^\d+$/;
export const SEMVER_VERSION =
  /^v?(?<release>\d+(\.\d+)*)(-(?<prerelease>[0-9a-z.-]+))?(\+[0-9a-z.-]+)?$/i;

const PEP440_EPOCH = "((?<epoch>\\d+)!)?";
const PEP440_RELEASE = "(?<release>\\d+(\\.\\d+)*)";
const PEP440_PRE = "([-_.]?(?<preLabel>alpha|a|beta|b|preview|pre|c|rc)[-_.]?(?<preNumber>\\d+)?)?";
const PEP440_POST =
  "(-(?<implicitPost>\\d+)|[-_.]?(?<postLabel>post|rev|r)[-_.]?(?<postNumber>\\d+)?)?";
const PEP440_DEV = "([-_.]?(?<devLabel>dev)[-_.]?(?<devNumber>\\d+)?)?";
const PEP440_LOCAL = "(\\+[a-z0-9]+([-_.][a-z0-9]+)*)?";
export const PEP440_VERSION = new RegExp(
  `^v?${PEP440_EPOCH}${PEP440_RELEASE}${PEP440_PRE}${PEP440_POST}${PEP440_DEV}${PEP440_LOCAL}$`,
);
export const PEP440_PRERELEASE_RANKS: Record<string, number> = {
  a: 0,
  alpha: 0,
  b: 1,
  beta: 1,
  c: 2,
  rc: 2,
  pre: 2,
  preview: 2,
};
