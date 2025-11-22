export interface CacheEntry {
  value: string;
  timestamp: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;
  private hits = 0;
  private misses = 0;

  constructor(ttlMinutes = 5) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > this.ttl;
    if (isExpired) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  set(key: string, value: string): void {
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return (this.hits / total) * 100;
  }
}

export const versionCache = new ResponseCache(5);

export class RequestDeduplicator {
  private pending = new Map<string, Promise<string>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existingRequest = this.pending.get(key);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }

    const promise = fn();
    this.pending.set(key, promise as Promise<string>);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pending.delete(key);
    }
  }

  clear(): void {
    this.pending.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();
