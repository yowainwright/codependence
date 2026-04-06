# Skill: Write a Test

Add a test that matches this codebase's patterns. Tests run with Bun's built-in test runner.

---

## File location

| What you're testing | Where to put it |
|---------------------|-----------------|
| Core scripts logic | `tests/unit/scripts/` |
| CLI argument parsing | `tests/unit/cli/` |
| Config loading/validation | `tests/unit/config/` |
| Utilities | `tests/unit/utils/` |
| `program.ts` / `action()` | `tests/unit/program.test.ts` |

---

## Required setup for any test touching scripts

```typescript
import { expect, test, jest, beforeEach } from 'bun:test';
import { versionCache, requestDeduplicator } from '../../../src/utils/cache';

beforeEach(() => {
  versionCache.clear();
  requestDeduplicator.clear();
});
```

Failure to clear the cache will cause tests to share state and produce false positives.

---

## Avoiding real network calls

Inject `exec` and `validate` rather than calling the real npm registry:

```typescript
const exec = jest.fn(() => ({ stdout: '4.0.0', stderr: '' }));
const validate = jest.fn(() => ({
  validForNewPackages: true,
  validForOldPackages: true,
  errors: [],
}));
```

Pass these into `constructVersionMap` or `checkFiles` as options.

---

## Avoiding real file writes

Use `isTesting: true` to suppress writes even when `update: true`:

```typescript
await checkFiles({
  codependencies: ['lodash'],
  update: true,
  isTesting: true,   // writes are logged but not applied
  exec,
  validate,
});
```

---

## Testing `checkFiles` end-to-end

Use the sandbox fixtures in `tests/sandboxes/` as the `rootDir`:

```typescript
test('basic check passes', async () => {
  const diffs = await checkFiles({
    codependencies: [{ lodash: '4.17.21' }],
    rootDir: 'tests/sandboxes/basic-check/',
    format: 'json',   // return data, skip exit/throw behavior
    isTesting: true,
  });

  expect(Array.isArray(diffs)).toBe(true);
});
```

---

## Testing `action()` (program-level)

Use `isTestingAction: true` to capture resolved options without executing `checkFiles`:

```typescript
import { action } from '../../src/program';

test('action merges config correctly', async () => {
  const result = await action({
    codependencies: ['lodash'],
    isTestingAction: true,
  });

  expect(result).toMatchObject({ isCLI: true, codependencies: ['lodash'] });
});
```

---

## Testing error paths

For errors that should throw (not exit), call without `isCLI`:

```typescript
test('throws when out of date', async () => {
  await expect(
    checkFiles({
      codependencies: [{ lodash: '3.0.0' }],   // deliberately wrong version
      rootDir: 'tests/sandboxes/basic-check/',
      isCLI: false,
      isTesting: false,
      exec,
      validate,
    })
  ).rejects.toThrow('Dependencies are not correct.');
});
```

---

## Running tests

```bash
bun test                                      # all tests
bun test tests/unit/scripts/index.test.ts    # single file
bun test --watch                              # watch mode
bun test --coverage                           # coverage report
```
