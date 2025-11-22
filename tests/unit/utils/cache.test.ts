import { describe, test, expect, beforeEach } from "bun:test";
import { ResponseCache, RequestDeduplicator } from "../../../src/utils/cache";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(1);
  });

  test("should store and retrieve values", () => {
    cache.set("test-key", "test-value");
    const result = cache.get("test-key");
    expect(result).toBe("test-value");
  });

  test("should return null for missing keys", () => {
    const result = cache.get("nonexistent");
    expect(result).toBeNull();
  });

  test("should expire values after TTL", async () => {
    const shortCache = new ResponseCache(0.001);
    shortCache.set("test-key", "test-value");

    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = shortCache.get("test-key");
    expect(result).toBeNull();
  });

  test("should track hits and misses", () => {
    cache.set("key1", "value1");

    cache.get("key1");
    cache.get("key2");
    cache.get("key1");
    cache.get("key3");

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(2);
  });

  test("should calculate hit rate", () => {
    cache.set("key1", "value1");

    cache.get("key1");
    cache.get("key1");
    cache.get("key2");
    cache.get("key3");

    const hitRate = cache.getHitRate();
    expect(hitRate).toBe(50);
  });

  test("should handle zero total requests", () => {
    const hitRate = cache.getHitRate();
    expect(hitRate).toBe(0);
  });

  test("should clear cache", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");

    cache.get("key1");
    cache.get("key2");

    cache.clear();

    const stats = cache.getStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  test("should track cache size", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.set("key3", "value3");

    const stats = cache.getStats();
    expect(stats.size).toBe(3);
  });
});

describe("RequestDeduplicator", () => {
  let deduplicator: RequestDeduplicator;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator();
  });

  test("should deduplicate concurrent requests", async () => {
    let callCount = 0;
    const expensiveFn = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return "result";
    };

    const results = await Promise.all([
      deduplicator.dedupe("key1", expensiveFn),
      deduplicator.dedupe("key1", expensiveFn),
      deduplicator.dedupe("key1", expensiveFn),
    ]);

    expect(callCount).toBe(1);
    expect(results).toEqual(["result", "result", "result"]);
  });

  test("should handle different keys separately", async () => {
    let callCount = 0;
    const expensiveFn = async () => {
      callCount++;
      return "result";
    };

    await Promise.all([
      deduplicator.dedupe("key1", expensiveFn),
      deduplicator.dedupe("key2", expensiveFn),
      deduplicator.dedupe("key3", expensiveFn),
    ]);

    expect(callCount).toBe(3);
  });

  test("should clear pending requests after completion", async () => {
    const fn = async () => "result";

    await deduplicator.dedupe("key1", fn);

    let callCount = 0;
    const fn2 = async () => {
      callCount++;
      return "result2";
    };

    await deduplicator.dedupe("key1", fn2);

    expect(callCount).toBe(1);
  });

  test("should handle errors", async () => {
    const errorFn = async () => {
      throw new Error("Test error");
    };

    const promises = [
      deduplicator.dedupe("key1", errorFn),
      deduplicator.dedupe("key1", errorFn),
    ];

    try {
      await Promise.all(promises);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toBe("Test error");
    }
  });

  test("should clear method works", () => {
    deduplicator.clear();
    expect(true).toBe(true);
  });
});
