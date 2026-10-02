import { after, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DiskCache } from "../../../../src/utils/cache";

const projects = new Set<string>();

after(() => {
  projects.forEach((project) => rmSync(project, { recursive: true, force: true }));
});

const createProject = (withModules = true): string => {
  const root = mkdtempSync(join(tmpdir(), "codependence-cache-"));
  projects.add(root);
  if (withModules) mkdirSync(join(root, "node_modules"));
  return root;
};

const cacheFile = (root: string, namespace: string): string =>
  join(root, "node_modules", ".cache", "codependence", `${namespace}.json`);

const writeRawCache = (root: string, namespace: string, content: string): void => {
  const path = cacheFile(root, namespace);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

test("DiskCache => persists flushed values for a new instance", () => {
  const rootDir = createProject();
  const writer = new DiskCache<string>("osv", { rootDir });

  writer.set("key", "value");
  writer.flush();

  assert.strictEqual(new DiskCache<string>("osv", { rootDir }).get("key"), "value");
});

test("DiskCache => writes nothing before flush", () => {
  const rootDir = createProject();
  const cache = new DiskCache<string>("osv", { rootDir });

  cache.set("key", "value");

  assert.strictEqual(existsSync(cacheFile(rootDir, "osv")), false);
});

test("DiskCache => flush without changes writes no file", () => {
  const rootDir = createProject();

  new DiskCache<string>("osv", { rootDir }).flush();

  assert.strictEqual(existsSync(cacheFile(rootDir, "osv")), false);
});

test("DiskCache => disabled cache ignores reads and writes", () => {
  const rootDir = createProject();
  const seeded = new DiskCache<string>("osv", { rootDir });
  seeded.set("key", "value");
  seeded.flush();

  const disabled = new DiskCache<string>("osv", { rootDir, enabled: false });
  disabled.set("other", "value");
  disabled.flush();

  assert.strictEqual(disabled.get("key"), undefined);
  assert.strictEqual(new DiskCache<string>("osv", { rootDir }).get("other"), undefined);
});

test("DiskCache => never creates node_modules", () => {
  const rootDir = createProject(false);
  const cache = new DiskCache<string>("osv", { rootDir });

  cache.set("key", "value");
  cache.flush();

  assert.strictEqual(cache.get("key"), undefined);
  assert.strictEqual(existsSync(join(rootDir, "node_modules")), false);
});

test("DiskCache => treats corrupt files as misses and recovers on write", () => {
  const rootDir = createProject();
  writeRawCache(rootDir, "osv", "{not json");
  const cache = new DiskCache<string>("osv", { rootDir });

  assert.strictEqual(cache.get("key"), undefined);
  cache.set("key", "value");
  cache.flush();

  assert.strictEqual(new DiskCache<string>("osv", { rootDir }).get("key"), "value");
});

test("DiskCache => ignores files from another schema version", () => {
  const rootDir = createProject();
  const stale = { version: 999, entries: { key: { t: 1, v: "old" } } };
  writeRawCache(rootDir, "osv", JSON.stringify(stale));

  assert.strictEqual(new DiskCache<string>("osv", { rootDir }).get("key"), undefined);
});

test("DiskCache => ignores files whose entries are missing", () => {
  const rootDir = createProject();
  writeRawCache(rootDir, "osv", JSON.stringify({ version: 1 }));

  assert.strictEqual(new DiskCache<string>("osv", { rootDir }).get("key"), undefined);
});

test("DiskCache => keeps the newest entries when over the limit", () => {
  const rootDir = createProject();
  const clock = { time: 0 };
  const now = (): number => {
    clock.time += 1;
    return clock.time;
  };
  const cache = new DiskCache<number>("osv", { rootDir, maxEntries: 2, now });

  [1, 2, 3].forEach((value) => {
    cache.set(`key-${value}`, value);
  });
  cache.flush();

  const reopened = new DiskCache<number>("osv", { rootDir });
  assert.strictEqual(reopened.get("key-1"), undefined);
  assert.strictEqual(reopened.get("key-2"), 2);
  assert.strictEqual(reopened.get("key-3"), 3);
});

test("DiskCache => keeps namespaces in separate files", () => {
  const rootDir = createProject();
  const first = new DiskCache<string>("first", { rootDir });
  first.set("key", "one");
  first.flush();

  assert.strictEqual(new DiskCache<string>("second", { rootDir }).get("key"), undefined);
  assert.ok(existsSync(cacheFile(rootDir, "first")));
});

test("DiskCache => leaves no temporary files behind", () => {
  const rootDir = createProject();
  const cache = new DiskCache<string>("osv", { rootDir });

  cache.set("key", "value");
  cache.flush();

  const content = readFileSync(cacheFile(rootDir, "osv"), "utf8");
  assert.deepStrictEqual(Object.keys(JSON.parse(content).entries), ["key"]);
  assert.strictEqual(existsSync(`${cacheFile(rootDir, "osv")}.${process.pid}.tmp`), false);
});
