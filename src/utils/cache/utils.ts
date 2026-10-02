import fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { CACHE_DIRECTORY_SEGMENTS, CACHE_SCHEMA_VERSION } from "./constants";
import type { CacheEntry, CacheFile } from "./types";

export const resolveCachePath = (
  rootDir: string,
  namespace: string,
  enabled: boolean,
): string | undefined => {
  if (!enabled) return undefined;
  const modulesDirectory = resolve(rootDir, "node_modules");
  const hasModules = fs.existsSync(modulesDirectory);
  if (!hasModules) return undefined;
  return join(modulesDirectory, ...CACHE_DIRECTORY_SEGMENTS, `${namespace}.json`);
};

const isCacheFile = <V>(value: unknown): value is CacheFile<V> => {
  const candidate = value as Partial<CacheFile<V>> | null;
  const isCurrent = candidate?.version === CACHE_SCHEMA_VERSION;
  const hasEntries = typeof candidate?.entries === "object";
  return isCurrent && hasEntries;
};

export const readEntries = <V>(path: string | undefined): Map<string, CacheEntry<V>> => {
  if (!path) return new Map();
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(path, "utf8"));
    if (!isCacheFile<V>(parsed)) return new Map();
    return new Map(Object.entries(parsed.entries));
  } catch {
    return new Map();
  }
};

export const mergeEntries = <V>(
  stored: Map<string, CacheEntry<V>>,
  pending: Map<string, CacheEntry<V>>,
): Map<string, CacheEntry<V>> => {
  const merged = new Map(stored);
  pending.forEach((entry, key) => {
    const existing = merged.get(key);
    const isCurrent = existing === undefined || entry.t >= existing.t;
    if (isCurrent) merged.set(key, entry);
  });
  return merged;
};

export const trimEntries = <V>(
  entries: Map<string, CacheEntry<V>>,
  maxEntries: number,
): Map<string, CacheEntry<V>> => {
  if (entries.size <= maxEntries) return entries;
  const newestFirst = Array.from(entries).sort(([, left], [, right]) => right.t - left.t);
  return new Map(newestFirst.slice(0, maxEntries));
};

export const writeEntries = <V>(path: string, entries: Map<string, CacheEntry<V>>): void => {
  const file: CacheFile<V> = {
    version: CACHE_SCHEMA_VERSION,
    entries: Object.fromEntries(entries),
  };
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(dirname(path), { recursive: true });
    fs.writeFileSync(temporaryPath, JSON.stringify(file));
    fs.renameSync(temporaryPath, path);
  } catch {
    const hasTemporaryFile = fs.existsSync(temporaryPath);
    if (hasTemporaryFile) fs.rmSync(temporaryPath, { force: true });
  }
};
