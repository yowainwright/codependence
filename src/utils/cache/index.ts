import { DEFAULT_MAX_ENTRIES } from "./constants";
import type { CacheEntry, DiskCacheOptions } from "./types";
import { mergeEntries, readEntries, resolveCachePath, trimEntries, writeEntries } from "./utils";

export class DiskCache<V> {
  private readonly path: string | undefined;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly entries: Map<string, CacheEntry<V>>;
  private isDirty = false;

  constructor(namespace: string, options: DiskCacheOptions = {}) {
    const { rootDir = process.cwd(), enabled = true } = options;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
    this.path = resolveCachePath(rootDir, namespace, enabled);
    this.entries = readEntries<V>(this.path);
  }

  get(key: string): V | undefined {
    return this.entries.get(key)?.v;
  }

  set(key: string, value: V): void {
    if (!this.path) return;
    this.entries.set(key, { t: this.now(), v: value });
    this.isDirty = true;
  }

  flush(): void {
    const { path } = this;
    if (!path) return;
    if (!this.isDirty) return;
    const merged = mergeEntries(readEntries<V>(path), this.entries);
    writeEntries(path, trimEntries(merged, this.maxEntries));
    this.isDirty = false;
  }
}

export type { DiskCacheOptions } from "./types";
