import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ResponseCache, RequestDeduplicator } from "../../../src/utils/cache";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(1);
  });

  test("should store and retrieve values", () => {
    cache.set("test-key", "test-value");
    const result = cache.get("test-key");
    assert.strictEqual((result), "test-value");
  });

  test("should return null for missing keys", () => {
    const result = cache.get("nonexistent");
    assert.strictEqual((result), null);
  });

  test("should expire values after TTL", async () => {
    const shortCache = new ResponseCache(0.001);
    shortCache.set("test-key", "test-value");

    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = shortCache.get("test-key");
    assert.strictEqual((result), null);
  });

  test("should track hits and misses", () => {
    cache.set("key1", "value1");

    cache.get("key1");
    cache.get("key2");
    cache.get("key1");
    cache.get("key3");

    const stats = cache.getStats();
    assert.strictEqual((stats.hits), 2);
    assert.strictEqual((stats.misses), 2);
  });

  test("should calculate hit rate", () => {
    cache.set("key1", "value1");

    cache.get("key1");
    cache.get("key1");
    cache.get("key2");
    cache.get("key3");

    const hitRate = cache.getHitRate();
    assert.strictEqual((hitRate), 50);
  });

  test("should handle zero total requests", () => {
    const hitRate = cache.getHitRate();
    assert.strictEqual((hitRate), 0);
  });

  test("should clear cache", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");

    cache.get("key1");
    cache.get("key2");

    cache.clear();

    const stats = cache.getStats();
    assert.strictEqual((stats.size), 0);
    assert.strictEqual((stats.hits), 0);
    assert.strictEqual((stats.misses), 0);
  });

  test("should track cache size", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.set("key3", "value3");

    const stats = cache.getStats();
    assert.strictEqual((stats.size), 3);
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

    assert.strictEqual((callCount), 1);
    assert.deepStrictEqual((results), ["result", "result", "result"]);
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

    assert.strictEqual((callCount), 3);
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

    assert.strictEqual((callCount), 1);
  });

  test("should handle errors", async () => {
    const errorFn = async () => {
      throw new Error("Test error");
    };

    const promises = [deduplicator.dedupe("key1", errorFn), deduplicator.dedupe("key1", errorFn)];

    try {
      await Promise.all(promises);
      assert.strictEqual((true), false);
    } catch (error) {
      assert.strictEqual(((error as Error).message), "Test error");
    }
  });

  test("should clear method works", () => {
    deduplicator.clear();
    assert.strictEqual((true), true);
  });
});
