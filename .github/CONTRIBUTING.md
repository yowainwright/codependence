# Contributing

## Setup

- Use Node.js 20 or newer.
- Install Bun from https://bun.sh.
- Run `bun install`.

## Local Checks

Before opening a pull request, run:

```sh
bun run build
bun run lint
bun run typecheck
bun run test
bun run deps:security
```

Use `bun run coverage` for changes that affect dependency parsing, update
logic, or CLI behavior.

## Pull Requests

- Keep changes focused on one issue or feature.
- Add or update tests for behavior changes.
- Update README or docs when command flags, config fields, or public APIs
  change.
- Describe the problem, the approach, and the local checks you ran.
