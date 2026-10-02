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
  validBatchResults,
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

test("compareVersions => treats missing trailing parts as zero on either side", () => {
  assert.ok(compareVersions("1.2.3", "1.2") > 0);
  assert.ok(compareVersions("1.2", "1.2.3") < 0);
});

test("toVulnerability => reports unknown severity when database_specific is absent", () => {
  const { database_specific: _omitted, ...details } = advisory();

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].severity, "unknown");
});

test("toVulnerability => leaves fixedIn unset when the advisory lists nothing affected", () => {
  const { affected: _omitted, ...details } = advisory();

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].fixedIn, undefined);
});

test("toVulnerability => skips affected entries without a package name", () => {
  const details = advisory({
    affected: [{ package: { ecosystem: "npm" }, ranges: [{ events: [{ fixed: "9.9.9" }] }] }],
  });

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].fixedIn, undefined);
});

test("toVulnerability => tolerates affected entries without ranges or events", () => {
  const details = advisory({
    affected: [
      { package: { name: "lodash", ecosystem: "npm" } },
      { package: { name: "lodash", ecosystem: "npm" }, ranges: [{}] },
    ],
  });

  assert.strictEqual(toVulnerability("GHSA-test", details, npmQuery)[0].fixedIn, undefined);
});

test("pruneVulnerability => fills in empty collections for sparse advisories", () => {
  const sparse = { id: "GHSA-sparse" } as OsvVulnerability;

  assert.deepStrictEqual(pruneVulnerability(sparse), {
    id: "GHSA-sparse",
    withdrawn: undefined,
    database_specific: { severity: undefined },
    affected: [],
  });
});

test("pruneVulnerability => keeps affected entries that have no ranges or package", () => {
  const sparse = { id: "GHSA-sparse", affected: [{}] } as OsvVulnerability;

  assert.deepStrictEqual(pruneVulnerability(sparse).affected, [
    { package: { name: undefined, ecosystem: undefined }, ranges: [] },
  ]);
});

test("compareVersions => orders a semver prerelease before its release", () => {
  assert.ok(compareVersions("1.0.5-rc.1", "1.0.5") < 0);
  assert.ok(compareVersions("1.0.5", "1.0.5-rc.1") > 0);
});

test("compareVersions => orders prerelease identifiers numerically and by stage", () => {
  assert.ok(compareVersions("1.0.5-rc.2", "1.0.5-rc.10") < 0);
  assert.ok(compareVersions("1.0.5-alpha.1", "1.0.5-beta.1") < 0);
  assert.ok(compareVersions("1.0.5-beta.1", "1.0.5-rc.1") < 0);
  assert.ok(compareVersions("1.0.5-rc", "1.0.5-rc.1") < 0);
  assert.ok(compareVersions("1.0.5-1", "1.0.5-alpha") < 0);
});

test("compareVersions => orders PEP 440 prereleases before the release", () => {
  assert.ok(compareVersions("1.0.5rc1", "1.0.5", "PyPI") < 0);
  assert.ok(compareVersions("1.0.5a1", "1.0.5b1", "PyPI") < 0);
  assert.ok(compareVersions("1.0.5b2", "1.0.5rc1", "PyPI") < 0);
  assert.ok(compareVersions("1.0.5.dev1", "1.0.5a1", "PyPI") < 0);
  assert.ok(compareVersions("1.0.5rc2", "1.0.5rc10", "PyPI") < 0);
  assert.ok(compareVersions("1.0.5rc", "1.0.5rc1", "PyPI") < 0);
  assert.strictEqual(compareVersions("1.0.5rc", "1.0.5rc0", "PyPI"), 0);
});

test("compareVersions => falls back to name order for unknown prerelease tags", () => {
  assert.ok(compareVersions("1.0.0-bar", "1.0.0-foo") < 0);
});

test("compareVersions => ignores a v prefix and build metadata", () => {
  assert.strictEqual(compareVersions("v1.2.3", "1.2.3"), 0);
  assert.strictEqual(compareVersions("1.2.3+build.5", "1.2.3"), 0);
});

test("toVulnerability => offers the release that fixes a prerelease install", () => {
  const prereleaseQuery: OsvQuery = { ...npmQuery, version: "4.17.21-rc.1" };
  const details = advisory({
    affected: [
      {
        package: { name: "lodash", ecosystem: "npm" },
        ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
      },
    ],
  });

  assert.strictEqual(toVulnerability("GHSA-test", details, prereleaseQuery)[0].fixedIn, "4.17.21");
});

test("compareVersions => orders prerelease identifiers symmetrically", () => {
  assert.ok(compareVersions("1.0.5-rc.1", "1.0.5-rc") > 0);
  assert.ok(compareVersions("1.0.5-alpha", "1.0.5-1") > 0);
  assert.strictEqual(compareVersions("1.0.5-rc.1", "1.0.5-rc.1"), 0);
});

test("compareVersions => treats unparseable versions as the lowest release", () => {
  assert.strictEqual(compareVersions("latest", "latest"), 0);
  assert.ok(compareVersions("latest", "1.0.0") < 0);
});

test("compareVersions => orders PEP 440 post releases after their release", () => {
  assert.ok(compareVersions("1.0.post1", "1.0", "PyPI") > 0);
  assert.ok(compareVersions("1.0.post", "1.0", "PyPI") > 0);
  assert.ok(compareVersions("1.0.post2", "1.0.post1", "PyPI") > 0);
  assert.ok(compareVersions("1.0.post1", "1.0rc1", "PyPI") > 0);
  assert.ok(compareVersions("1.0.post1", "1.0.1", "PyPI") < 0);
  assert.ok(compareVersions("1.0-1", "1.0", "PyPI") > 0);
});

test("compareVersions => keeps the dev part of a PEP 440 post release", () => {
  assert.ok(compareVersions("1.0.post1.dev1", "1.0.post1", "PyPI") < 0);
  assert.ok(compareVersions("1.0.post1.dev1", "1.0", "PyPI") > 0);
});

test("compareVersions => applies PEP 440 epochs, trailing zeros and local versions", () => {
  assert.ok(compareVersions("1!1.0", "2.0", "PyPI") > 0);
  assert.strictEqual(compareVersions("1.0", "1.0.0", "PyPI"), 0);
  assert.strictEqual(compareVersions("1.0+local.1", "1.0", "PyPI"), 0);
});

test("compareVersions => reads the same text by the rules of its ecosystem", () => {
  assert.ok(compareVersions("1.0.0-rc.1", "1.0.0", "npm") < 0);
  assert.ok(compareVersions("1.0.0-rc.1", "1.0.0-rc.2", "crates.io") < 0);
  assert.ok(compareVersions("1.0.0-1", "1.0.0", "npm") < 0);
  assert.ok(compareVersions("1.0.0-1", "1.0.0", "PyPI") > 0);
});

test("toVulnerability => offers a post release as the fix", () => {
  const pypiQuery: OsvQuery = {
    name: "pkg",
    version: "1.0",
    language: "python",
    ecosystem: "PyPI",
    key: securityKey("python", "pkg", "1.0"),
  };
  const details = advisory({
    affected: [
      {
        package: { name: "pkg", ecosystem: "PyPI" },
        ranges: [{ events: [{ fixed: "1.0.post1" }] }],
      },
    ],
  });

  assert.strictEqual(toVulnerability("PYSEC-1", details, pypiQuery)[0].fixedIn, "1.0.post1");
});

test("validBatchResults => returns results that match the query count", () => {
  const response = { results: [{}, { vulns: [{ id: "A", modified: "1" }] }] };

  assert.deepStrictEqual(validBatchResults(response, 2), response.results);
});

test("validBatchResults => rejects anything that is not a complete, well-formed response", () => {
  const malformed = [
    null,
    "text",
    [],
    {},
    { results: "nope" },
    { results: [{}] },
    { results: [null] },
    { results: [{ vulns: "A" }] },
    { results: [{ vulns: null }] },
    { results: [{ vulns: [null] }] },
    { results: [{ vulns: [{ modified: "1" }] }] },
  ];

  malformed.forEach((response) => {
    assert.deepStrictEqual(validBatchResults(response, 2), []);
  });
});

test("toVulnerability => offers the post release that fixes a post-release dev build", () => {
  const pypiQuery: OsvQuery = {
    name: "pkg",
    version: "1.0.post1.dev1",
    language: "python",
    ecosystem: "PyPI",
    key: securityKey("python", "pkg", "1.0.post1.dev1"),
  };
  const details = advisory({
    affected: [
      {
        package: { name: "pkg", ecosystem: "PyPI" },
        ranges: [{ events: [{ fixed: "1.0.post1" }] }],
      },
    ],
  });

  assert.strictEqual(toVulnerability("PYSEC-1", details, pypiQuery)[0].fixedIn, "1.0.post1");
});
