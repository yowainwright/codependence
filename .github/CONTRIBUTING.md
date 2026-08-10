# Contributing

## Setup

- Use Node.js 26.
- Install Nub and Bun.
- Run `nub install`.

## Local Checks

Before opening a pull request, run:

```sh
nub run build
nub run lint
nub run typecheck
nub run test
```

Use `nub run coverage` for changes that affect dependency parsing, update
logic, or CLI behavior.

## Pull Requests

- Keep changes focused on one issue or feature.
- Add or update tests for behavior changes.
- Update README or docs when command flags, config fields, or public APIs
  change.
- Describe the problem, the approach, and the local checks you ran.
