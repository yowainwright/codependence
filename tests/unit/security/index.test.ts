import { after, mock, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSecurity, securityKey } from "../../../src/security";
import type { CachedAdvisory, SecurityFetch } from "../../../src/security";
import { DiskCache } from "../../../src/utils/cache";

type FakeAdvisory = {
  id: string;
  modified: string;
  severity?: string;
  withdrawn?: string;
  packageName: string;
  ecosystem: string;
  fixed?: string;
};

type OsvRequest = { url: string; body?: { queries: Array<{ package: { name: string } }> } };

const roots = new Set<string>();

after(() => {
  roots.forEach((root) => rmSync(root, { recursive: true, force: true }));
});

const lodashHigh: FakeAdvisory = {
  id: "GHSA-high",
  modified: "2026-01-01T00:00:00Z",
  severity: "HIGH",
  packageName: "lodash",
  ecosystem: "npm",
  fixed: "4.17.21",
};

const lodashModerate: FakeAdvisory = {
  id: "GHSA-moderate",
  modified: "2026-01-01T00:00:00Z",
  severity: "MODERATE",
  packageName: "lodash",
  ecosystem: "npm",
  fixed: "4.17.23",
};

const details = (advisory: FakeAdvisory) => ({
  id: advisory.id,
  withdrawn: advisory.withdrawn,
  database_specific: { severity: advisory.severity },
  summary: "extra field that must not be stored",
  affected: [
    {
      package: { name: advisory.packageName, ecosystem: advisory.ecosystem },
      ranges: [{ events: [{ introduced: "0" }, { fixed: advisory.fixed }] }],
    },
  ],
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

type OsvBehavior = { failDetails?: boolean; failBatch?: boolean; delay?: number };
type BatchBody = { queries: Array<{ package: { name: string } }> };

const refsFor = (affected: Record<string, FakeAdvisory[]>, name: string) =>
  (affected[name] ?? []).map(({ id, modified }) => ({ id, modified }));

const batchResponse = (affected: Record<string, FakeAdvisory[]>, body: BatchBody): Response => {
  const results = body.queries.map((query) => ({ vulns: refsFor(affected, query.package.name) }));
  return json({ results });
};

const detailResponse = (catalog: Map<string, FakeAdvisory>, url: string): Response => {
  const advisory = catalog.get(decodeURIComponent(url.split("/").pop() ?? ""));
  if (!advisory) return json({}, 404);
  return json(details(advisory));
};

const parseBody = (init?: RequestInit): BatchBody | undefined => {
  if (!init?.body) return undefined;
  return JSON.parse(String(init.body));
};

const createLookup =
  (
    catalog: Map<string, FakeAdvisory>,
    behavior: OsvBehavior,
    flight: { active: number; peak: number },
  ) =>
  async (url: string): Promise<Response> => {
    flight.active += 1;
    flight.peak = Math.max(flight.peak, flight.active);
    await new Promise((resolve) => setTimeout(resolve, behavior.delay ?? 0));
    flight.active -= 1;
    if (behavior.failDetails) return json({}, 500);
    return detailResponse(catalog, url);
  };

const createOsv = (affected: Record<string, FakeAdvisory[]>, behavior: OsvBehavior = {}) => {
  const requests: OsvRequest[] = [];
  const flight = { active: 0, peak: 0 };
  const catalog = new Map(
    Object.values(affected)
      .flat()
      .map((item) => [item.id, item]),
  );
  const lookup = createLookup(catalog, behavior, flight);
  const fetch: SecurityFetch = (url, init) => {
    const body = parseBody(init);
    requests[requests.length] = { url, body };
    if (!url.endsWith("/querybatch")) return lookup(url);
    if (!body) return Promise.resolve(json({}, 500));
    if (behavior.failBatch) return Promise.resolve(json({}, 500));
    return Promise.resolve(batchResponse(affected, body));
  };
  const detailRequests = () => requests.filter(({ url }) => !url.endsWith("/querybatch"));
  const batchRequests = () => requests.filter(({ url }) => url.endsWith("/querybatch"));
  return { fetch, requests, detailRequests, batchRequests, flight };
};

const lodashQuery = { name: "lodash", version: "4.17.20", language: "nodejs" as const };
const lodashKey = securityKey("nodejs", "lodash", "4.17.20");

const createCache = (enabled = true): DiskCache<CachedAdvisory> => {
  const rootDir = mkdtempSync(join(tmpdir(), "codependence-security-"));
  roots.add(rootDir);
  mkdirSync(join(rootDir, "node_modules"));
  return new DiskCache<CachedAdvisory>("osv", { rootDir, enabled });
};

test("checkSecurity => reports vulnerabilities with severity and fixing version", async () => {
  const osv = createOsv({ lodash: [lodashHigh, lodashModerate] });
  const results = await checkSecurity([lodashQuery], { fetch: osv.fetch });

  assert.deepStrictEqual(results.get(lodashKey), {
    checked: true,
    vulnerabilities: [
      { id: "GHSA-high", severity: "high", fixedIn: "4.17.21" },
      { id: "GHSA-moderate", severity: "moderate", fixedIn: "4.17.23" },
    ],
  });
});

test("checkSecurity => reports a clean package as checked with no vulnerabilities", async () => {
  const osv = createOsv({});
  const results = await checkSecurity([lodashQuery], { fetch: osv.fetch });

  assert.deepStrictEqual(results.get(lodashKey), { checked: true, vulnerabilities: [] });
  assert.strictEqual(osv.detailRequests().length, 0);
});

test("checkSecurity => omits unsupported ecosystems and makes no request for them", async () => {
  const osv = createOsv({});
  const results = await checkSecurity(
    [
      { name: "nginx", version: "1.19", language: "docker" },
      { name: "actions/checkout", version: "v4", language: "github-actions" },
      { name: "pkg", version: "latest", language: "nodejs" },
    ],
    { fetch: osv.fetch },
  );

  assert.strictEqual(results.size, 0);
  assert.strictEqual(osv.requests.length, 0);
});

test("checkSecurity => leaves packages out of the result when the batch call fails", async () => {
  const osv = createOsv({ lodash: [lodashHigh] }, { failBatch: true });
  const results = await checkSecurity([lodashQuery], { fetch: osv.fetch });

  assert.strictEqual(results.has(lodashKey), false);
});

test("checkSecurity => leaves packages out when the network rejects", async () => {
  const fetch: SecurityFetch = () => Promise.reject(new Error("offline"));
  const results = await checkSecurity([lodashQuery], { fetch });

  assert.strictEqual(results.size, 0);
});

test("checkSecurity => keeps advisory ids with unknown severity when details fail", async () => {
  const osv = createOsv({ lodash: [lodashHigh] }, { failDetails: true });
  const results = await checkSecurity([lodashQuery], { fetch: osv.fetch });

  assert.deepStrictEqual(results.get(lodashKey)?.vulnerabilities, [
    { id: "GHSA-high", severity: "unknown" },
  ]);
});

test("checkSecurity => skips withdrawn advisories", async () => {
  const withdrawn = { ...lodashHigh, withdrawn: "2026-02-01T00:00:00Z" };
  const osv = createOsv({ lodash: [withdrawn, lodashModerate] });
  const results = await checkSecurity([lodashQuery], { fetch: osv.fetch });

  assert.deepStrictEqual(
    results.get(lodashKey)?.vulnerabilities.map(({ id }) => id),
    ["GHSA-moderate"],
  );
});

test("checkSecurity => fetches a shared advisory once", async () => {
  const shared = { ...lodashHigh, packageName: "lodash" };
  const osv = createOsv({ lodash: [shared], "lodash-es": [shared] });
  await checkSecurity(
    [lodashQuery, { name: "lodash-es", version: "4.17.20", language: "nodejs" }],
    { fetch: osv.fetch },
  );

  assert.strictEqual(osv.batchRequests().length, 1);
  assert.strictEqual(osv.detailRequests().length, 1);
});

test("checkSecurity => splits large scans into batches of 1000 queries", async () => {
  const osv = createOsv({});
  const queries = Array.from({ length: 1001 }, (_, index) => ({
    name: `pkg-${index}`,
    version: "1.0.0",
    language: "nodejs" as const,
  }));
  const results = await checkSecurity(queries, { fetch: osv.fetch });

  assert.deepStrictEqual(
    osv.batchRequests().map(({ body }) => body?.queries.length),
    [1000, 1],
  );
  assert.strictEqual(results.size, 1001);
});

test("checkSecurity => limits concurrent advisory lookups", async () => {
  const advisories = Array.from({ length: 12 }, (_, index) => ({
    ...lodashHigh,
    id: `GHSA-${index}`,
  }));
  const osv = createOsv({ lodash: advisories }, { delay: 5 });
  await checkSecurity([lodashQuery], { fetch: osv.fetch, concurrency: 3 });

  assert.strictEqual(osv.detailRequests().length, 12);
  assert.ok(osv.flight.peak <= 3);
});

test("checkSecurity => a warm cache skips every advisory lookup", async () => {
  const cache = createCache();
  const first = createOsv({ lodash: [lodashHigh, lodashModerate] });
  const cold = await checkSecurity([lodashQuery], { fetch: first.fetch, cache });

  const second = createOsv({ lodash: [lodashHigh, lodashModerate] });
  const warm = await checkSecurity([lodashQuery], { fetch: second.fetch, cache });

  assert.strictEqual(first.detailRequests().length, 2);
  assert.strictEqual(second.batchRequests().length, 1);
  assert.strictEqual(second.detailRequests().length, 0);
  assert.deepStrictEqual(warm, cold);
});

test("checkSecurity => refetches an advisory whose modified time changed", async () => {
  const cache = createCache();
  await checkSecurity([lodashQuery], {
    fetch: createOsv({ lodash: [lodashHigh] }).fetch,
    cache,
  });

  const updated = { ...lodashHigh, modified: "2026-03-01T00:00:00Z", severity: "CRITICAL" };
  const osv = createOsv({ lodash: [updated] });
  const results = await checkSecurity([lodashQuery], { fetch: osv.fetch, cache });

  assert.strictEqual(osv.detailRequests().length, 1);
  assert.strictEqual(results.get(lodashKey)?.vulnerabilities[0].severity, "critical");
});

test("checkSecurity => a disabled cache always refetches", async () => {
  const cache = createCache(false);
  const first = createOsv({ lodash: [lodashHigh] });
  await checkSecurity([lodashQuery], { fetch: first.fetch, cache });
  const second = createOsv({ lodash: [lodashHigh] });
  await checkSecurity([lodashQuery], { fetch: second.fetch, cache });

  assert.strictEqual(second.detailRequests().length, 1);
});

test("checkSecurity => stores only the fields it needs", async () => {
  const cache = createCache();
  await checkSecurity([lodashQuery], { fetch: createOsv({ lodash: [lodashHigh] }).fetch, cache });

  const stored = cache.get(lodashHigh.id);
  assert.strictEqual(stored?.modified, lodashHigh.modified);
  assert.strictEqual("summary" in (stored?.details ?? {}), false);
});

test("checkSecurity => does not cache failed lookups", async () => {
  const cache = createCache();
  const failing = createOsv({ lodash: [lodashHigh] }, { failDetails: true });
  await checkSecurity([lodashQuery], { fetch: failing.fetch, cache });

  const recovered = createOsv({ lodash: [lodashHigh] });
  const results = await checkSecurity([lodashQuery], { fetch: recovered.fetch, cache });

  assert.strictEqual(recovered.detailRequests().length, 1);
  assert.strictEqual(results.get(lodashKey)?.vulnerabilities[0].severity, "high");
});

test("checkSecurity => treats an OSV result without a vulns key as clean", async () => {
  const fetch: SecurityFetch = () => Promise.resolve(json({ results: [{}] }));
  const results = await checkSecurity([lodashQuery], { fetch });

  assert.deepStrictEqual(results.get(lodashKey), { checked: true, vulnerabilities: [] });
});

test("checkSecurity => uses the global fetch when none is injected", async () => {
  const osv = createOsv({ lodash: [lodashHigh] });
  const globalFetch = mock.method(globalThis, "fetch", osv.fetch);

  try {
    const results = await checkSecurity([lodashQuery]);

    assert.strictEqual(globalFetch.mock.callCount(), 2);
    assert.strictEqual(results.get(lodashKey)?.vulnerabilities[0].id, "GHSA-high");
  } finally {
    globalFetch.mock.restore();
  }
});

test("checkSecurity => reports a failed batch through onError", async () => {
  const osv = createOsv({ lodash: [lodashHigh] }, { failBatch: true });
  const messages: string[] = [];
  await checkSecurity([lodashQuery], {
    fetch: osv.fetch,
    onError: (message) => {
      messages[messages.length] = message;
    },
  });

  assert.strictEqual(messages.length, 1);
  assert.match(messages[0], /OSV security check failed for 1 packages/);
  assert.match(messages[0], /status 500/);
});

test("checkSecurity => reports a network failure through onError", async () => {
  const messages: string[] = [];
  const fetch: SecurityFetch = () => Promise.reject(new Error("offline"));
  await checkSecurity([lodashQuery], {
    fetch,
    onError: (message) => {
      messages[messages.length] = message;
    },
  });

  assert.match(messages[0], /offline/);
});

test("checkSecurity => reports an incomplete OSV response through onError", async () => {
  const messages: string[] = [];
  const fetch: SecurityFetch = () => Promise.resolve(json({ results: [] }));
  await checkSecurity([lodashQuery], {
    fetch,
    onError: (message) => {
      messages[messages.length] = message;
    },
  });

  assert.match(messages[0], /unexpected response/);
});

test("checkSecurity => limits concurrent batch requests", async () => {
  const flight = { active: 0, peak: 0, calls: 0 };
  const fetch: SecurityFetch = async (_url, init) => {
    flight.calls += 1;
    flight.active += 1;
    flight.peak = Math.max(flight.peak, flight.active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    flight.active -= 1;
    const body = JSON.parse(String(init?.body));
    return json({ results: body.queries.map(() => ({})) });
  };
  const queries = Array.from({ length: 2001 }, (_, index) => ({
    name: `pkg-${index}`,
    version: "1.0.0",
    language: "nodejs" as const,
  }));
  const results = await checkSecurity(queries, { fetch });

  assert.strictEqual(flight.calls, 3);
  assert.ok(flight.peak <= 2);
  assert.strictEqual(results.size, 2001);
});

const malformedBodies: Array<[string, unknown]> = [
  ["null", null],
  ["a null result", { results: [null] }],
  ["non-list vulns", { results: [{ vulns: "GHSA-1" }] }],
  ["null vulns", { results: [{ vulns: null }] }],
  ["a vuln without an id", { results: [{ vulns: [{ modified: "1" }] }] }],
];

malformedBodies.forEach(([label, body]) => {
  test(`checkSecurity => degrades to not checked for ${label}`, async () => {
    const messages: string[] = [];
    const fetch: SecurityFetch = () => Promise.resolve(json(body));
    const results = await checkSecurity([lodashQuery], {
      fetch,
      onError: (message) => {
        messages[messages.length] = message;
      },
    });

    assert.strictEqual(results.size, 0);
    assert.match(messages[0], /unexpected response/);
  });
});
