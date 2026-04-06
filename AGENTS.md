# Agents

Codependence is a dependency version management tool which can be leveraged via cli or Node.js module. It ensures specified packages stay pinned at correct versions, or that all packages (excluding pinned ones) are updated to their latest published versions with the ability to do safely (safest match) or latest, which will even attempt to jump version.

This tool is useful because of its simplicity and the way it updates—everything at once. This is useful for team clarity when managing dependencies (one PR) and managing cross project updates; eg this project updates it's package and immediately bumps other projects with standard workflow dispatches or cron jobs. I find this approach to be very understandable for humans compared to similar services. 

---

## Public API

The primary export is `checkFiles`. The CLI maps entirely to this function.

```typescript
import { checkFiles } from 'codependence';

const diffs = await checkFiles({
  codependencies: ['react', 'lodash'],  // packages to pin or check
  update: false,       // if true, writes updated versions to package.json
  dryRun: false,       // if true, shows what would change — no writes
  isTesting: false,    // if true, suppresses file writes even when update: true
  format: 'json',      // 'json' | 'markdown' | 'table' — returns data, skips exit logic
  permissive: true,    // default: true — update all EXCEPT codependencies
  mode: 'precise',     // 'precise' | 'verbose'
});
```

`codependence` is an alias for `checkFiles` — they are identical.

---

## Key Concepts

**Permissive mode** (default `permissive: true`): Update every dependency to latest *except* those listed in `codependencies`. The listed packages act as a blocklist.

**Verbose mode** (`mode: 'verbose'`): Only check/update the packages listed in `codependencies`. Ignore everything else.

**Precise mode** (`mode: 'precise'` or `permissive: true` without explicit mode): Check all packages across all dep sections against the registry. Constructs a full version map of every dependency found in matched files.

**codependencies**: Array of strings or single-key objects:
- `"react"` — fetch latest from registry, pin at that version
- `{ "react": "^18.0.0" }` — use this exact version, skip registry lookup

---

## Return Value

`checkFiles` returns `Promise<VersionDiff[] | void>`:

```typescript
type VersionDiff = {
  package: string;      // package name
  current: string;      // version currently in package.json
  latest: string;       // latest from registry, or pinned version
  isPinned: boolean;    // true if this is a codependency
  willUpdate: boolean;
};
```

`VersionDiff[]` is returned when `format` is set or when `update`/`dryRun` is true. In other cases the function returns `void` and results are printed to stdout.

---

## Safe Operations

These options produce no side effects and are safe to run without confirmation:

```typescript
// Preview what would change — no writes
await checkFiles({ dryRun: true, update: true });

// Return structured data — bypasses checkMatches entirely (no exit, no writes)
await checkFiles({ format: 'json' });

// Test mode — prevents all file writes regardless of update flag
await checkFiles({ isTesting: true });

// Debug — logs internal state without changing behavior
await checkFiles({ debug: true });
```

**Important**: When `format` is set, `checkMatches` is skipped. Out-of-date dependencies will not cause `process.exit(1)` or any error, regardless of the `update` flag.

---

## Destructive Operations

These modify `package.json` files on disk. Confirm with the user before proceeding.

```typescript
// Writes updated versions to package.json
await checkFiles({ update: true });

// Prompts user interactively before writing
await checkFiles({ update: true, interactive: true });
```

---

## Configuration

Config is loaded in this order — first match wins, no merging across sources:

1. `--config <path>` — explicit file
2. `.codependencerc` — searched upward from cwd or `searchPath`
3. `package.json#codependence` — searched upward from cwd or `searchPath`

**Merge precedence** (higher overrides lower):

1. Programmatic options / CLI arguments
2. `--config` file contents
3. Found config (`.codependencerc` or `package.json#codependence`)

**Gotcha**: If a `--config` file is provided and non-empty, the found config (baseConfig) is fully discarded — not merged. This is intentional; explicit config wins entirely.

---

## Testing Patterns

Tests inject `exec` and `validate` to avoid network calls, and use `isTesting: true` to prevent file writes.

```typescript
import { versionCache, requestDeduplicator } from '../src/utils/cache';
import { constructVersionMap } from '../src/scripts';

beforeEach(() => {
  versionCache.clear();
  requestDeduplicator.clear();
});

test('example', async () => {
  const exec = jest.fn(() => ({ stdout: '4.0.0', stderr: '' }));
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
  }));

  const result = await constructVersionMap({
    codependencies: ['lodash'],
    exec,
    validate,
    isTesting: true,
  });

  expect(result).toEqual({ lodash: '4.0.0' });
});
```

Use `isTestingAction: true` to capture what `action()` would do without executing:

```typescript
const result = await action({ codependencies: ['lodash'], isTestingAction: true });
// result contains the resolved options without running checkFiles
```

---

## Known Sharp Edges

**`checkMatches` exits vs. throws.** When `isCLI: true` and deps are out of date, it calls `process.exit(1)`. In library mode it throws `Error("Dependencies are not correct.")`. Never set `isCLI: true` in programmatic usage.

**`PackageJSON.path` is a runtime addition.** The type requires `path` but disk files don't have it — it is injected before processing at `scripts/index.ts:449`. Do not expect it to be present in parsed JSON from disk.

**`permissive: isPreciseMode` in checkMatches.** Inside `checkFiles`, the `isPreciseMode` boolean is passed as the `permissive` argument to `checkMatches`. This is correct behavior but the naming looks inverted — precise mode enables permissive-style checking across all deps.

**`mergeConfigs` drops baseConfig.** If a `--config` file exists and is non-empty, `baseConfig` is ignored entirely (not merged). Partial `--config` files are not supplemented by the found config.

---

## Running the CLI

```bash
codependence                         # check, report, exit 1 if out of date
codependence --update                # check and update package.json files
codependence --update --dryRun       # preview changes without writing
codependence --format json           # output structured JSON, no exit behavior
codependence --config ./my.json      # use specific config file
codependence --debug                 # verbose internal logging
codependence init                    # interactive config setup
```

## Running Tests

```bash
bun test                              # all unit tests
bun test tests/unit/scripts/          # scripts only
bun test tests/unit/program.test.ts   # program/CLI tests
bun test --coverage                   # with coverage report
```
