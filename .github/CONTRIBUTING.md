# Contributing

## Setup

- Use Node.js 26.
- Install [Nub 0.7.5][nub-install] from the official `@nubjs/nub` package:

  ```sh
  npm install --global @nubjs/nub@0.7.5
  ```

- Run `nub install`.

## Local Checks

Before opening a pull request, run:

```sh
nub run build
nub run lint
nub run test
```

Use `nub run coverage` for changes that affect dependency parsing, update
logic, or CLI behavior.

Turbo runs builds, lint, tests, coverage, and docs. `nub run validate` builds
the CLI and docs before testing and runs lint; add `--force` to bypass caching.
Target one test file with `nub run test -- tests/unit/scripts/release/index.test.ts`.

Install the pnpm version pinned in `package.json` if missing; CI installs it.
`nub exec --node` prevents Nub/pnpm runtime conflicts. Use `nub install` for
dependencies; tasks warn about drift without reinstalling.

Publishing forces validation and a CLI build before packing. Native builds
and shell checks are uncached; release creation and publication stay outside Turbo.

## Pull Requests

- Keep changes focused on one issue or feature.
- Add or update tests for behavior changes.
- Update README or docs when command flags, config fields, or public APIs
  change.
- Describe the problem, the approach, and the local checks you ran.

[nub-install]: https://nubjs.com/docs/install
