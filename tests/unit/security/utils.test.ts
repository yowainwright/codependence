import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunk,
  compareVersions,
  mapWithConcurrency,
  pruneVulnerability,
  securityKey,
  toOsvQueries,
  toVulnerability,
  uniqueAdvisories,
} from "../../../src/security/utils";
import type { OsvQuery, OsvVulnerability } from "../../../src/security/types";

const npmQuery: OsvQuery = {
  name: "lodash",
  version: "4.17.20",
  language: "nodejs",
  ecosystem: "npm",
  key: securityKey("nodejs", "lodash", "4.17.20"),
};

const advisory = (overrides: Partial<OsvVulnerability> = {}): OsvVulnerability => ({
  id: "GHSA-test",
  database_specific: { severity: "HIGH" },
  affected: [
    {
      package: { name: "lodash", ecosystem: "npm" },
      ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
    },
  ],
  ...overrides,
});

test("chunk => splits items into groups of the given size", () => {
  assert.deepStrictEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepStrictEqual(chunk([], 3), []);
});

test("mapWithConcurrency => preserves input order", async () => {
  const delays = [30, 5, 15];
  const result = await mapWithConcurrency(delays, 3, async (delay) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return delay;
  });

  assert.deepStrictEqual(result, delays);
});

test("mapWithConcurrency => never exceeds the limit", async () => {
  const state = { active: 0, peak: 0 };
  await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
    state.active += 1;
    state.peak = Math.max(state.peak, state.active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    state.active -= 1;
  });

  assert.strictEqual(state.peak, 2);
});

test("mapWithConcurrency => handles empty input", async () => {
  assert.deepStrictEqual(await mapWithConcurrency([], 4, (item) => Promise.resolve(item)), []);
});

test("compareVersions => orders dotted numbers", () => {
  assert.ok(compareVersions("4.17.21", "4.17.20") > 0);
  assert.ok(compareVersions("4.9.0", "4.17.0") < 0);
  assert.strictEqual(compareVersions("1.2", "1.2.0"), 0);
});

test("toOsvQueries => keeps supported ecosystems and drops the rest", () => {
  const queries = toOsvQueries([
    { name: "lodash", version: "4.17.20", language: "nodejs" },
    { name: "requests", version: "2.19.0", language: "python" },
    { name: "golang.org/x/text", version: "v0.3.0", language: "go" },
    { name: "time", version: "0.1.43", language: "rust" },
    { name: "nginx", version: "1.19", language: "docker" },
    { name: "actions/checkout", version: "v4", language: "github-actions" },
  ]);

  assert.deepStrictEqual(
    queries.map(({ ecosystem }) => ecosystem),
    ["npm", "PyPI", "Go", "crates.io"],
  );
});

test("toOsvQueries => drops versions that are not concrete", () => {
  const versions = ["latest", "*", ">=1.0.0 <2.0.0", "", "^1.2.3"];
  const queries = toOsvQueries(
    versions.map((version) => ({ name: "pkg", version, language: "nodejs" as const })),
  );

  assert.deepStrictEqual(queries, []);
});

test("toOsvQueries => deduplicates identical queries", () => {
  const query = { name: "lodash", version: "4.17.20", language: "nodejs" as const };

  assert.strictEqual(toOsvQueries([query, query]).length, 1);
});

test("securityKey => separates ecosystems", () => {
  assert.notStrictEqual(
    securityKey("nodejs", "requests", "1.0.0"),
    securityKey("python", "requests", "1.0.0"),
  );
});

test("uniqueAdvisories => returns each advisory id once", () => {
  const entries = [
    {
      query: npmQuery,
      advisories: [
        { id: "A", modified: "1" },
        { id: "B", modified: "1" },
      ],
    },
    { query: npmQuery, advisories: [{ id: "A", modified: "1" }] },
  ];

  assert.deepStrictEqual(
    uniqueAdvisories(entries).map(({ id }) => id),
    ["A", "B"],
  );
});

test("toVulnerability => normalizes severity and picks the fixing version", () => {
  assert.deepStrictEqual(toVulnerability("GHSA-test", advisory(), npmQuery), [
    { id: "GHSA-test", severity: "high", fixedIn: "4.17.21" },
  ]);
});

test("toVulnerability => reports unknown severity for unrecognized values", () => {
  const details = advisory({ database_specific: { severity: "SEVERE" } });

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].severity, "unknown");
});

test("toVulnerability => keeps the id when details are unavailable", () => {
  assert.deepStrictEqual(toVulnerability("GHSA-test", undefined, npmQuery), [
    { id: "GHSA-test", severity: "unknown" },
  ]);
});

test("toVulnerability => skips withdrawn advisories", () => {
  const details = advisory({ withdrawn: "2024-01-01T00:00:00Z" });

  assert.deepStrictEqual(toVulnerability("GHSA-test", details, npmQuery), []);
});

test("toVulnerability => chooses the smallest fix above the scanned version", () => {
  const details = advisory({
    affected: [
      {
        package: { name: "lodash", ecosystem: "npm" },
        ranges: [
          { events: [{ introduced: "0" }, { fixed: "4.17.21" }] },
          { events: [{ fixed: "3.0.0" }] },
        ],
      },
      {
        package: { name: "lodash", ecosystem: "npm" },
        ranges: [{ events: [{ fixed: "4.18.0" }] }],
      },
    ],
  });

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].fixedIn, "4.17.21");
});

test("toVulnerability => ignores fixes for other packages in the same advisory", () => {
  const details = advisory({
    affected: [
      {
        package: { name: "lodash-es", ecosystem: "npm" },
        ranges: [{ events: [{ fixed: "9.9.9" }] }],
      },
    ],
  });

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].fixedIn, undefined);
});

test("toVulnerability => leaves fixedIn unset when no fix exists", () => {
  const details = advisory({
    affected: [
      {
        package: { name: "lodash", ecosystem: "npm" },
        ranges: [{ events: [{ introduced: "0" }] }],
      },
    ],
  });

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].fixedIn, undefined);
});

test("toVulnerability => matches PyPI names after normalization", () => {
  const pypiQuery: OsvQuery = {
    name: "My_Package",
    version: "1.0.0",
    language: "python",
    ecosystem: "PyPI",
    key: securityKey("python", "My_Package", "1.0.0"),
  };
  const details = advisory({
    affected: [
      {
        package: { name: "my-package", ecosystem: "PyPI" },
        ranges: [{ events: [{ fixed: "1.2.0" }] }],
      },
    ],
  });

  assert.strictEqual(toVulnerability("PYSEC-1", details, pypiQuery)[0].fixedIn, "1.2.0");
});

test("pruneVulnerability => keeps only the fields the report uses", () => {
  const raw = {
    ...advisory(),
    details: "a very long description",
    references: [{ url: "https://example.test" }],
    summary: "summary",
  } as OsvVulnerability;
  const pruned = pruneVulnerability(raw);

  assert.deepStrictEqual(Object.keys(pruned).sort(), [
    "affected",
    "database_specific",
    "id",
    "withdrawn",
  ]);
  assert.deepStrictEqual(
    toVulnerability("GHSA-test", pruned, npmQuery),
    toVulnerability("GHSA-test", raw, npmQuery),
  );
});
