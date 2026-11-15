# CLI sandboxes and e2e tests

Run commands from the repository root. Docker supplies the built CLI, Node, npm, Python and the project’s Pastoralist version.

## Manual testing

Open any scenario:

```sh
./tests/e2e/test.sh dev init
./tests/e2e/test.sh dev monorepo
./tests/e2e/test.sh dev major-updates
./tests/e2e/test.sh dev security
./tests/e2e/test.sh dev verbose-mode
./tests/e2e/test.sh dev precise-mode
./tests/e2e/test.sh dev basic-check
./tests/e2e/test.sh dev permissive-mode
```

Inside the shell, use `codependence` and `pastoralist`. Exit to discard changes; reopen to reset. Source fixtures stay unchanged.

## Automated testing

Run every scenario, one scenario, or the complete Node e2e suite:

```sh
./tests/e2e/test.sh scenarios
./tests/e2e/test.sh scenarios major-updates
./tests/e2e/test.sh all
```

The scenario suite runs in CI. It checks init output, workspace updates, real-terminal major confirmation, audit results, package selection, dry runs and update levels. Interactive selection and watch are manual checks.

Without Docker, build first. Node, npm and Python 3 are required; security uses the installed Pastoralist:

```sh
nub install --frozen-lockfile --ignore-scripts
nub run build-dist
./tests/e2e/test-scenarios.sh all
./tests/e2e/test-scenarios.sh major-updates
./tests/e2e/test-scenarios.sh dev major-updates
```

Precise mode, permissive mode and audits need registry access. Results can change with releases and advisories. Fixed version targets work offline.

Exit codes: `0` success, `1` outdated dependencies, `2` CLI error. Checks and dry runs can return `1`.

## Init

Open `dev init`. Run one setup command per fresh session:

```sh
codependence init --skip-install
codependence init rc
codependence init package
codependence init default
```

`rc` and `default` create `.codependencerc`; `package` writes policy into `package.json`. Repeat `init rc` to check existing-config detection.

For noninteractive setup and a workflow:

```sh
codependence init --mode precise --codependencies react \
  --enforcement github --repository acme/sandbox \
  --version npm=11.0.0 --non-interactive --skip-install
codependence init actions npm --version npm=11.0.0 --force
```

Inspect `package.json` and `.github/workflows/codependence-node.yml`.

## Monorepo

Open `dev monorepo`. Inside:

```sh
codependence --config package.json --update --dryRun
codependence --config package.json --update
```

Accept: Chalk becomes `4.1.2` and Lodash `4.17.21` across eligible manifests, preserving range prefixes. Decline: every Chalk entry stays unchanged; Lodash updates.

Preview file selection and exclusions:

```sh
codependence --config package.json --files packages/web/package.json --update --dryRun
codependence --config package.json --ignore 'packages/api/**' --update --dryRun
```

In a fresh session, test workspace discovery:

```sh
cp init-package-test.json package.json
codependence init config --mode precise --codependencies chalk --non-interactive --skip-install
```

Expect `.codependencerc` to include both child manifests.

## Major updates

Open `dev major-updates`. Inside:

```sh
codependence --config package.json --update
```

Enter defaults to No: React stays `18.2.0`; Semver becomes `7.6.0`; Lodash becomes `^4.17.21`. Answer `y` to also update React to `19.0.0`.

Reset before each comparison:

```sh
cp package-test.json package.json
codependence --config package.json --update --interactive
```

Space toggles a package; Enter confirms selection. Selecting React triggers major confirmation. Unselected packages stay unchanged.

These commands skip confirmation and apply all targets; reset between them:

```sh
CI=1 codependence --config package.json --update
codependence --config package.json --update | cat
codependence --config package.json --update --quiet
codependence --config package.json --update --format json
```

Test duplicate versions:

```sh
cp duplicate-package-test.json package.json
codependence --config package.json --update
```

Decline: both Chalk entries stay unchanged. Accept: both become `4.1.2`. Lodash updates in either case.

## Security

Open `dev security`. Create a lockfile without installing dependencies or running scripts:

```sh
npm install --package-lock-only --ignore-scripts --workspaces=false
npm audit
pastoralist --dry-run --checkSecurity --strict
```

Expect findings for Undici and ip-address. Apply patches, refresh the lockfile and audit again:

```sh
codependence --config package.json --update --level patch
npm install --package-lock-only --ignore-scripts --workspaces=false
npm audit
pastoralist --dry-run --checkSecurity --strict --refresh-cache
```

Expect Undici `7.30.1` and ip-address `10.7.4`. Original findings should clear; newer advisories may add others.

To test Pastoralist’s approval prompt, start fresh, create the lockfile, then run:

```sh
pastoralist --checkSecurity --interactive --strict
```

## Verbose mode

Open `dev verbose-mode`. Inside:

```sh
codependence --config package.json --update --dryRun
codependence --config package.json --update
```

Only Lodash changes, to `^4.17.21`. React and Chalk stay unchanged. `--mode verbose` controls package selection; `--verbose` adds logs.

## Precise mode

Open `dev precise-mode`. Inside:

```sh
codependence --config package.json --update --dryRun
codependence --config package.json --update
```

React stays `18.2.0`. Lodash and Chalk target registry versions; review any major prompt. Hold Lodash instead:

```sh
cp package-test.json package.json
codependence --config package.json --mode precise --codependencies lodash --update --dryRun
```

## Basic checks and CLI options

Open `dev basic-check`. Reset with `cp package-test.json package.json` before comparing updates:

```sh
codependence --config package.json
codependence --config package.json --update --dryRun
codependence --config package.json --update --level patch
codependence --config package.json --update --level minor
```

Patch updates Lodash to `^4.17.21`. Minor also updates React to `18.3.1`. Dry run writes nothing.

Reports and logging:

```sh
codependence --config package.json --format json --outputFile dependency-report.json
codependence --config package.json --format markdown --outputFile dependency-report.md
codependence --config package.json --quiet
codependence --config package.json --verbose
codependence --config package.json --debug
```

Selection, cache, watch and help:

```sh
codependence --config package.json --update --interactive
codependence --config package.json --noCache --update --dryRun
codependence --config package.json --watch
codependence --help
codependence --legend
codependence --styleguide
```

Watch checks every 30 seconds. Edit a version in another terminal and wait; Ctrl-C stops watching.

## Permissive alias

Open `dev permissive-mode`. Inside:

```sh
codependence --config package.json --permissive --update --dryRun
codependence --config package.json --mode precise --update --dryRun
codependence --config package.json --permissive --update --interactive
```

Both modes hold React, React DOM and React Router at the fixture versions. Other packages are eligible for registry updates.

Fixtures live in `tests/e2e/fixtures/scenarios/`. Manifests use `package-test.json` so repository audits skip deliberately outdated dependencies. The runner creates real manifests in disposable directories using `helpers.sh`.

## Script names

Use `test-<command>-cmd.sh` for command tests, such as `test-init-cmd.sh`. Use `test-<option>-opt.sh` for option tests, such as `test-level-mode-opt.sh`. Provider tests use `test-provider-<provider>.sh`. Existing workflow suites retain their descriptive names; `test.sh` is the runner and `helpers.sh` contains shared utilities.

The root `fs-lint.json` enforces these patterns for top-level e2e shell scripts. Check existing scripts or a proposed filename:

```sh
rg --files tests/e2e -g '*.sh' -0 | fs-lint check --stdin0
fs-lint check tests/e2e/test-init-cmd.sh
```
