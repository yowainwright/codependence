import type { SupportedLanguage, Vulnerability } from "../types";
import {
  DEFAULT_PRERELEASE_RANK,
  NUMERIC_TOKEN,
  OSV_ECOSYSTEMS,
  OSV_SEVERITIES,
  OSV_TIMEOUT_MS,
  POST_RELEASE_TAG,
  PRERELEASE_RANKS,
  QUERYABLE_VERSION,
} from "./constants";
import type {
  OsvAdvisoryRef,
  OsvAffected,
  OsvBatchEntry,
  OsvQuery,
  OsvRangeEvent,
  OsvVulnerability,
  ParsedVersion,
  SecurityFetch,
  SecurityQuery,
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

const parseVersion = (version: string): ParsedVersion => {
  const match = /^v?(\d+(?:\.\d+)*)(.*)$/.exec(version.trim());
  const [, core = "", rest = ""] = match ?? [];
  const suffix = rest.split("+")[0].replace(/^[-._]/, "");
  const tokens = suffix.match(/\d+|[a-z]+/gi) ?? [];
  const isPostRelease = POST_RELEASE_TAG.test(tokens[0] ?? "");
  return {
    release: core.split(".").filter(Boolean).map(Number),
    prerelease: isPostRelease ? [] : tokens,
  };
};

const compareReleases = (left: number[], right: number[]): number => {
  const length = Math.max(left.length, right.length);
  const differences = Array.from(
    { length },
    (_, index) => (left[index] ?? 0) - (right[index] ?? 0),
  );
  return differences.find((value) => value !== 0) ?? 0;
};

const prereleaseRank = (token: string): number =>
  PRERELEASE_RANKS[token.toLowerCase()] ?? DEFAULT_PRERELEASE_RANK;

const compareTokens = (left: string | undefined, right: string | undefined): number => {
  const isLeftMissing = left === undefined;
  const isRightMissing = right === undefined;
  if (isLeftMissing) return -1;
  if (isRightMissing) return 1;
  const isLeftNumeric = NUMERIC_TOKEN.test(left);
  const isRightNumeric = NUMERIC_TOKEN.test(right);
  const areBothNumeric = isLeftNumeric && isRightNumeric;
  if (areBothNumeric) return Number(left) - Number(right);
  if (isLeftNumeric) return -1;
  if (isRightNumeric) return 1;
  const rankOrder = prereleaseRank(left) - prereleaseRank(right);
  return rankOrder || left.localeCompare(right);
};

const comparePrereleases = (left: string[], right: string[]): number => {
  const isLeftRelease = left.length === 0;
  const isRightRelease = right.length === 0;
  if (isLeftRelease) return Number(!isRightRelease);
  if (isRightRelease) return -1;
  const length = Math.max(left.length, right.length);
  const differences = Array.from({ length }, (_, index) =>
    compareTokens(left[index], right[index]),
  );
  return differences.find((value) => value !== 0) ?? 0;
};

export const compareVersions = (left: string, right: string): number => {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  const releaseOrder = compareReleases(leftVersion.release, rightVersion.release);
  const prereleaseOrder = comparePrereleases(leftVersion.prerelease, rightVersion.prerelease);
  return releaseOrder || prereleaseOrder;
};

const normalizeName = (ecosystem: string, name: string): string => {
  const isPyPI = ecosystem === "PyPI";
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
  return fixes
    .filter((fixed) => compareVersions(fixed, query.version) > 0)
    .sort(compareVersions)[0];
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
