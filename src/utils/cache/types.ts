export type CacheEntry<V> = {
  t: number;
  v: V;
};

export type CacheFile<V> = {
  version: number;
  entries: Record<string, CacheEntry<V>>;
};

export type DiskCacheOptions = {
  rootDir?: string;
  maxEntries?: number;
  enabled?: boolean;
  now?: () => number;
};
