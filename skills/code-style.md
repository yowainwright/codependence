# Skill: Code Style

Standards for this codebase. Apply these before submitting any change.

---

## General

- No useless comments. If the code reads clearly, the comment adds nothing.
- No speculative abstractions. Build for what exists, not what might exist.
- No backwards-compatibility shims for removed code.
- Hoist conditional logic into named variables before using it in an `if` or ternary.

```typescript
// wrong
if ((e.metaKey || e.ctrlKey) && e.key === "k") { ... }

// right
const isModified = e.metaKey || e.ctrlKey;
if (isModified && e.key === "k") { ... }
```

---

## File structure

Use a directory when a module has distinct types, constants, and logic worth isolating:

```
feature/
├── index.ts        # public API / main logic
├── types.ts        # types only
├── constants.ts    # constants only
└── index.test.ts   # tests
```

Only split into a directory when the file has enough distinct concerns to justify it. A single small file is fine.

---

## Components (React)

Co-locate sub-components in the same file as their parent. Do not create a new file for every component.

```typescript
// wrong — SearchTrigger.tsx, SearchInput.tsx, SearchDialog.tsx as separate files

// right — all in Search/index.tsx
function SearchTrigger(...) { ... }
function SearchInput(...) { ... }
function SearchDialog(...) { ... }
export default function Search() { ... }
```

Only move a component to its own file when it is reused across multiple unrelated parents.

Use semantic HTML. Prefer `<article>`, `<section>`, `<nav>`, `<header>`, `<search>`, `<ul>/<li>` over `<div>` soup.

Move handler logic into `utils.ts` where it can be tested independently of React.

---

## TypeScript

Hoist `if` statement conditions into named variables:

```typescript
// wrong
if (!depsToUpdate.depList.length && !depsToUpdate.devDepList.length) { ... }

// right
const hasNoDependencyIssues =
  !depsToUpdate.depList.length &&
  !depsToUpdate.devDepList.length;
if (hasNoDependencyIssues) { ... }
```

Avoid `as` casts that bypass the type system. Handle both `Error` and string errors explicitly:

```typescript
// wrong
logger.error((err as string).toString());

// right
const message = err instanceof Error ? err.message : String(err);
logger.error(message);
```

---

## Error handling

Surface errors to the user with context. Silent failures are not acceptable.

```typescript
// wrong
try {
  return JSON.parse(content);
} catch {
  return null;
}

// right
try {
  return JSON.parse(content);
} catch (err) {
  throw new Error(`Invalid JSON in ${filepath}: ${(err as Error).message}`);
}
```

`ENOENT` (file not found) is a normal condition — return `null`. Malformed content is not — throw with a message that tells the user what file has the problem.

---

## Logging (frontend)

Use `logger` from `@/utils/logger`, not bare `console`. The logger routes to reporters (Sentry, etc.) and has consistent prefixing.

```typescript
// wrong
console.error("Failed to load search index:", error);
console.log("Code not found");

// right
logger.error("FuseSearch: failed to load search index", error);
logger.warn("CopyButton: code element not found");
```

---

## Singletons

Global state should be initialized via a singleton, not a module-level variable.

```typescript
// wrong
const reporters: Reporter[] = [];

// right
class LoggerService {
  private static instance: LoggerService;
  private reporters: Reporter[] = [];
  private constructor() {}
  static getInstance() {
    if (!LoggerService.instance) LoggerService.instance = new LoggerService();
    return LoggerService.instance;
  }
}
export const logger = LoggerService.getInstance();
```
