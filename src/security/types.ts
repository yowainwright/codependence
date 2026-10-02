import type { SupportedLanguage } from "../types";
import type { DiskCache } from "../utils/cache";

export type SecurityQuery = {
  name: string;
  version: string;
  language: SupportedLanguage;
};

export type SecurityFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type CachedAdvisory = {
  modified: string;
  details: OsvVulnerability;
};

export type AdvisoryCache = DiskCache<CachedAdvisory>;

export type SecurityOptions = {
  fetch?: SecurityFetch;
  concurrency?: number;
  cache?: AdvisoryCache;
  onError?: (message: string) => void;
};

export type ParsedVersion = {
  release: number[];
  prerelease: string[];
  post: number;
};

export type OsvQuery = SecurityQuery & {
  ecosystem: string;
  key: string;
};

export type OsvAdvisoryRef = {
  id: string;
  modified?: string;
};

export type OsvBatchEntry = {
  query: OsvQuery;
  advisories: OsvAdvisoryRef[];
};

export type OsvBatchResult = {
  vulns?: OsvAdvisoryRef[];
};

export type OsvBatchResponse = {
  results?: OsvBatchResult[];
};

export type OsvRangeEvent = {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
};

export type OsvAffected = {
  package?: { name?: string; ecosystem?: string };
  ranges?: Array<{ events?: OsvRangeEvent[] }>;
};

export type OsvVulnerability = {
  id: string;
  withdrawn?: string;
  affected?: OsvAffected[];
  database_specific?: { severity?: string };
};
