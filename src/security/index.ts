import type { SecurityResult } from "../types";
import { OSV_API_URL, OSV_BATCH_CONCURRENCY, OSV_BATCH_LIMIT, OSV_CONCURRENCY } from "./constants";
import type {
  AdvisoryCache,
  OsvAdvisoryRef,
  OsvBatchEntry,
  OsvBatchResponse,
  OsvQuery,
  OsvVulnerability,
  SecurityFetch,
  SecurityOptions,
  SecurityQuery,
} from "./types";
import {
  chunk,
  fetchJson,
  mapWithConcurrency,
  pruneVulnerability,
  securityKey,
  toOsvQueries,
  toVulnerability,
  uniqueAdvisories,
} from "./utils";

const failureMessage = (error: unknown, count: number): string => {
  const reason = error instanceof Error ? error.message : "unexpected response";
  return `OSV security check failed for ${count} packages (${reason}); they are reported as not checked`;
};

const queryBatch = async (
  fetchFn: SecurityFetch,
  queries: OsvQuery[],
  onError?: (message: string) => void,
): Promise<OsvBatchEntry[]> => {
  const body = JSON.stringify({
    queries: queries.map(({ name, version, ecosystem }) => ({
      package: { name, ecosystem },
      version,
    })),
  });
  const request = { method: "POST", body };
  const response = await fetchJson<OsvBatchResponse>(
    fetchFn,
    `${OSV_API_URL}/querybatch`,
    request,
  ).catch((error: unknown) => error);
  const results = (response instanceof Error ? undefined : response.results) ?? [];
  const isComplete = results.length === queries.length;
  if (!isComplete) {
    onError?.(failureMessage(response, queries.length));
    return [];
  }
  return queries.map((query, index) => ({ query, advisories: results[index].vulns ?? [] }));
};

const advisoryDetails = async (
  fetchFn: SecurityFetch,
  advisory: OsvAdvisoryRef,
  cache: AdvisoryCache | undefined,
): Promise<OsvVulnerability | undefined> => {
  const cached = cache?.get(advisory.id);
  const isFresh = cached !== undefined && cached.modified === advisory.modified;
  if (isFresh) return cached.details;
  const url = `${OSV_API_URL}/vulns/${encodeURIComponent(advisory.id)}`;
  const fetched = await fetchJson<OsvVulnerability>(fetchFn, url).catch(() => undefined);
  if (!fetched) return undefined;
  const details = pruneVulnerability(fetched);
  if (advisory.modified) cache?.set(advisory.id, { modified: advisory.modified, details });
  return details;
};

const fetchDetails = async (
  fetchFn: SecurityFetch,
  advisories: OsvAdvisoryRef[],
  options: { concurrency: number; cache?: AdvisoryCache },
): Promise<Map<string, OsvVulnerability | undefined>> => {
  const details = await mapWithConcurrency(advisories, options.concurrency, (advisory) =>
    advisoryDetails(fetchFn, advisory, options.cache),
  );
  return new Map(advisories.map(({ id }, index) => [id, details[index]]));
};

const toResult = (
  { query, advisories }: OsvBatchEntry,
  details: Map<string, OsvVulnerability | undefined>,
): SecurityResult => ({
  checked: true,
  vulnerabilities: advisories.flatMap(({ id }) => toVulnerability(id, details.get(id), query)),
});

export const checkSecurity = async (
  queries: SecurityQuery[],
  options: SecurityOptions = {},
): Promise<Map<string, SecurityResult>> => {
  const fetchFn = options.fetch ?? fetch;
  const concurrency = options.concurrency ?? OSV_CONCURRENCY;
  const batches = await mapWithConcurrency(
    chunk(toOsvQueries(queries), OSV_BATCH_LIMIT),
    OSV_BATCH_CONCURRENCY,
    (batch) => queryBatch(fetchFn, batch, options.onError),
  );
  const entries = batches.flat();
  const advisories = uniqueAdvisories(entries);
  const details = await fetchDetails(fetchFn, advisories, { concurrency, cache: options.cache });
  options.cache?.flush();
  return new Map(entries.map((entry) => [entry.query.key, toResult(entry, details)]));
};

export { securityKey };
export type {
  AdvisoryCache,
  CachedAdvisory,
  SecurityFetch,
  SecurityOptions,
  SecurityQuery,
} from "./types";
