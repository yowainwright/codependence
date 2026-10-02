import type { SupportedLanguage, Vulnerability } from "../types";
import {
  NUMERIC_IDENTIFIER,
  OSV_ECOSYSTEMS,
  OSV_SEVERITIES,
  OSV_TIMEOUT_MS,
  PEP440_PRERELEASE_RANKS,
  PEP440_VERSION,
  PYPI_ECOSYSTEM,
  QUERYABLE_VERSION,
  SEMVER_VERSION,
} from "./constants";
import type {
  OsvAdvisoryRef,
  OsvAffected,
  OsvBatchEntry,
  OsvBatchResult,
  OsvQuery,
  OsvRangeEvent,
  OsvVulnerability,
  Pep440Version,
  SecurityFetch,
  SecurityQuery,
  SemverVersion,
} from "./types";

export const securityKey = (language: SupportedLanguage, name: string, version: string): string =>
  `${language}\0${name}\0${version}`;

export const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  const cursor = { next: 0 };
  const worker = async (): Promise<void> => {
    const index = cursor.next;
    const isDone = index >= items.length;
    if (isDone) return;
    cursor.next = index + 1;
    results[index] = await run(items[index]);
    return worker();
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
};

export const fetchJson = async <T>(
  fetchFn: SecurityFetch,
  url: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetchFn(
    url,
    Object.assign({}, init, { signal: AbortSignal.timeout(OSV_TIMEOUT_MS) }),
  );
  if (!response.ok) throw new Error(`OSV request failed with status ${response.status}`);
  return (await response.json()) as T;
};

export const toOsvQueries = (queries: SecurityQuery[]): OsvQuery[] => {
  const unique = new Map<string, OsvQuery>();
  queries.forEach((query) => {
    const ecosystem = OSV_ECOSYSTEMS[query.language] ?? "";
    const isSkipped = !ecosystem || !QUERYABLE_VERSION.test(query.version);
    if (isSkipped) return;
    const key = securityKey(query.language, query.name, query.version);
    unique.set(key, Object.assign({}, query, { ecosystem, key }));
  });
  return Array.from(unique.values());
};

const order = (left: number, right: number): number => Number(left > right) - Number(left < right);

const firstDifference = (values: number[]): number => values.find((value) => value !== 0) ?? 0;

const compareNumberLists = (left: number[], right: number[]): number => {
  const length = Math.max(left.length, right.length);
  const differences = Array.from({ length }, (_, index) =>
    order(left[index] ?? 0, right[index] ?? 0),
  );
  return firstDifference(differences);
};

const toNumbers = (release: string): number[] => release.split(".").filter(Boolean).map(Number);

const matchGroups = (pattern: RegExp, text: string): Record<string, string | undefined> => {
  const match = pattern.exec(text);
  if (!match) return {};
  return { ...match.groups };
};

const parseSemver = (version: string): SemverVersion => {
  const { release = "", prerelease = "" } = matchGroups(SEMVER_VERSION, version.trim());
  return { release: toNumbers(release), prerelease: prerelease.split(".").filter(Boolean) };
};

const compareIdentifiers = (left: string | undefined, right: string | undefined): number => {
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  const isLeftNumeric = NUMERIC_IDENTIFIER.test(left);
  const isRightNumeric = NUMERIC_IDENTIFIER.test(right);
  const areBothNumeric = isLeftNumeric && isRightNumeric;
  if (areBothNumeric) return order(Number(left), Number(right));
  if (isLeftNumeric) return -1;
  if (isRightNumeric) return 1;
  return Number(left > right) - Number(left < right);
};

const comparePrereleases = (left: string[], right: string[]): number => {
  const isLeftRelease = left.length === 0;
  const isRightRelease = right.length === 0;
  if (isLeftRelease) return Number(!isRightRelease);
  if (isRightRelease) return -1;
  const length = Math.max(left.length, right.length);
  const differences = Array.from({ length }, (_, index) =>
    compareIdentifiers(left[index], right[index]),
  );
  return firstDifference(differences);
};

const compareSemver = (left: string, right: string): number => {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);
  const releaseOrder = compareNumberLists(leftVersion.release, rightVersion.release);
  const prereleaseOrder = comparePrereleases(leftVersion.prerelease, rightVersion.prerelease);
  return firstDifference([releaseOrder, prereleaseOrder]);
};

const pep440Pre = (
  label: string | undefined,
  number: string | undefined,
  isDevOnly: boolean,
): number[] => {
  const hasLabel = label !== undefined;
  if (hasLabel) return [PEP440_PRERELEASE_RANKS[label], Number(number ?? 0)];
  if (isDevOnly) return [-1, 0];
  return [Infinity, 0];
};

const numberOr = (isPresent: boolean, value: number, fallback: number): number => {
  if (isPresent) return value;
  return fallback;
};

const parsePep440 = (version: string): Pep440Version => {
  const groups = matchGroups(PEP440_VERSION, version.trim().toLowerCase());
  const { epoch = "0", release = "", preLabel, preNumber, implicitPost } = groups;
  const { postLabel, postNumber = "0", devLabel, devNumber = "0" } = groups;
  const hasPost = implicitPost !== undefined || postLabel !== undefined;
  const hasDev = devLabel !== undefined;
  const isDevOnly = hasDev && !hasPost && preLabel === undefined;
  return {
    epoch: Number(epoch),
    release: toNumbers(release),
    pre: pep440Pre(preLabel, preNumber, isDevOnly),
    post: numberOr(hasPost, Number(implicitPost || postNumber), -1),
    dev: numberOr(hasDev, Number(devNumber), Infinity),
  };
};

const comparePep440 = (left: string, right: string): number => {
  const leftVersion = parsePep440(left);
  const rightVersion = parsePep440(right);
  return firstDifference([
    order(leftVersion.epoch, rightVersion.epoch),
    compareNumberLists(leftVersion.release, rightVersion.release),
    compareNumberLists(leftVersion.pre, rightVersion.pre),
    order(leftVersion.post, rightVersion.post),
    order(leftVersion.dev, rightVersion.dev),
  ]);
};

export const compareVersions = (left: string, right: string, ecosystem = ""): number => {
  const isPython = ecosystem === PYPI_ECOSYSTEM;
  if (isPython) return comparePep440(left, right);
  return compareSemver(left, right);
};

const normalizeName = (ecosystem: string, name: string): string => {
  const isPyPI = ecosystem === PYPI_ECOSYSTEM;
  if (!isPyPI) return name;
  return name.toLowerCase().replace(/[-_.]+/g, "-");
};

const severityOf = (vulnerability: OsvVulnerability): Vulnerability["severity"] => {
  const severity = vulnerability.database_specific?.severity?.toLowerCase() ?? "";
  const isKnown = OSV_SEVERITIES.has(severity);
  if (!isKnown) return "unknown";
  return severity as Vulnerability["severity"];
};

const matchingEvents = (vulnerability: OsvVulnerability, query: OsvQuery): OsvRangeEvent[] => {
  const name = normalizeName(query.ecosystem, query.name);
  const isMatch = ({ package: affected }: OsvAffected): boolean =>
    affected?.ecosystem === query.ecosystem &&
    normalizeName(query.ecosystem, affected.name ?? "") === name;
  const ranges = (vulnerability.affected ?? []).filter(isMatch).flatMap((a) => a.ranges ?? []);
  return ranges.flatMap((range) => range.events ?? []);
};

const fixedVersion = (vulnerability: OsvVulnerability, query: OsvQuery): string | undefined => {
  const fixes = matchingEvents(vulnerability, query).flatMap(({ fixed }) => fixed ?? []);
  const compare = (left: string, right: string): number =>
    compareVersions(left, right, query.ecosystem);
  return fixes.filter((fixed) => compare(fixed, query.version) > 0).sort(compare)[0];
};

export const uniqueAdvisories = (entries: OsvBatchEntry[]): OsvAdvisoryRef[] => {
  const advisories = entries.flatMap((entry) => entry.advisories);
  return Array.from(new Map(advisories.map((advisory) => [advisory.id, advisory])).values());
};

const pruneAffected = ({ package: affected, ranges }: OsvAffected): OsvAffected => ({
  package: { name: affected?.name, ecosystem: affected?.ecosystem },
  ranges: (ranges ?? []).map(({ events }) => ({ events })),
});

export const pruneVulnerability = (vulnerability: OsvVulnerability): OsvVulnerability => ({
  id: vulnerability.id,
  withdrawn: vulnerability.withdrawn,
  database_specific: { severity: vulnerability.database_specific?.severity },
  affected: (vulnerability.affected ?? []).map(pruneAffected),
});

export const toVulnerability = (
  id: string,
  details: OsvVulnerability | undefined,
  query: OsvQuery,
): Vulnerability[] => {
  if (!details) return [{ id, severity: "unknown" }];
  if (details.withdrawn) return [];
  return [{ id, severity: severityOf(details), fixedIn: fixedVersion(details, query) }];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isAdvisoryRef = (value: unknown): value is OsvAdvisoryRef =>
  isObject(value) && typeof value.id === "string";

const isBatchResult = (value: unknown): value is OsvBatchResult => {
  if (!isObject(value)) return false;
  const vulns = value.vulns;
  const isAbsent = vulns === undefined;
  if (isAbsent) return true;
  const isList = Array.isArray(vulns);
  if (!isList) return false;
  return vulns.every(isAdvisoryRef);
};

const resultsOf = (response: unknown): unknown => {
  if (!isObject(response)) return undefined;
  return response.results;
};

export const validBatchResults = (response: unknown, expected: number): OsvBatchResult[] => {
  const results = resultsOf(response);
  const isList = Array.isArray(results);
  if (!isList) return [];
  const isComplete = results.length === expected;
  const isValid = results.every(isBatchResult);
  const isUsable = isComplete && isValid;
  if (!isUsable) return [];
  return results;
};
