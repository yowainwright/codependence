# [Codependence](https://jeffry.in/codependence/)

[![npm version](https://img.shields.io/npm/v/codependence.svg)](https://www.npmjs.com/package/codependence)
[![npm downloads](https://img.shields.io/npm/dm/codependence.svg)](https://www.npmjs.com/package/codependence)
[![TypeScript](https://img.shields.io/badge/TypeScript-types%20included-blue)](https://www.typescriptlang.org/)
![CI](https://github.com/yowainwright/codependence/actions/workflows/ci.yml/badge.svg)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/yowainwright/codependence/badge)](https://scorecard.dev/viewer/?uri=github.com/yowainwright/codependence)
[![codecov](https://codecov.io/gh/yowainwright/codependence/branch/main/graph/badge.svg)](https://codecov.io/gh/yowainwright/codependence)
[![GitHub stars](https://img.shields.io/github/stars/yowainwright/codependence?style=social)](https://github.com/yowainwright/codependence)

#### One `.codependencerc` for every dependency manager.

**Codependence** checks, reports, and updates dependency versions from one repository policy. A root `.codependencerc` can manage Node, Python, Go, Rust, Docker, and GitHub Actions dependencies independently across local development and CI.

---

## _Main Use Case_

#### Keep important versions intentional

Codependence loads one `.codependencerc` and applies each manager-specific target to its own files. It can keep only listed dependencies current or pin selected dependencies while updating everything else.

The difference from `{npm,pnpm} update` or `yarn upgrade` is that Codependence gives you an explicit policy surface: _these versions matter, these packages may move, and CI should fail when the repo drifts_.

The difference from hosted update bots is scope. Dependabot and Renovate are strong choices for scheduled dependency pull requests. Codependence is useful when dependency policy needs to run locally, in a script, in any CI provider, or across multiple manifests without depending on a hosted bot workflow.

#### \*yes, dependencies can be pinned to `~` or `^` versions in `package.json` files!

Read more about [Codependence](#synopsis) and why you might want to use it [below](#why-use-codependence).

---

## Usage

**Codependence** can be used as a standalone CLI, in npm scripts or, secondarily, as a Node utility.

#### Install

```sh
npm install codependence --save-dev
pnpm add codependence --save-dev
bun add codependence --dev
yarn add codependence --dev
```

#### Agent skills

Install the `eslint-plugin-legibility` agent skill directly:

```sh
npx eslint-plugin-legibility-install-skill
npx eslint-plugin-legibility-install-skill --target codex
npx eslint-plugin-legibility-install-skill --target claude
```

This repo also has wrapper scripts for contributor setup:

```sh
bun run skills:install        # default shared agent skills location
bun run skills:install:codex  # Codex global skill location
bun run skills:install:claude # Claude rules location
```

For project-local installs, generated files are ignored by git:

```sh
bun run skills:install:local
bun run skills:install:codex:local
bun run skills:install:claude:local
```

#### Quick setup

Create the recommended root `.codependencerc` with [manager targets](#one-codependencerc-every-manager), then run every configured manager:

```sh
codependence
codependence --update
```

For a one-off check without a config:

```sh
codependence --codependencies 'react' 'lodash' --update
```

Legacy projects can embed the policy in the root `package.json`:

```ts
{
  "codependence": {
    "codependencies": ["react", "lodash"]
  },
  "scripts": {
    "update-codependencies": "codependence --update",
    "prepare": "npm run update-codependencies"
  }
}
```

By default, a `codependencies` list keeps the 0.x behavior: only those listed
dependencies are checked and updated. To pin specific packages while updating
everything else, opt into policy/permissive mode:

```sh
codependence --permissive --codependencies 'react' 'lodash' --update
```

Or run a policy check without writing files:

```sh
codependence --permissive --codependencies 'react' 'lodash' --dryRun
```

#### Initialize Codependence

Quickly set up Codependence in your project with the interactive init command:

<!-- init command behavior from src/program.ts -->

```sh
# Create the recommended root .codependencerc interactively
codependence init

# Create .codependencerc with all dependencies pinned (legacy mode)
codependence init rc

# Create .codependencerc with listed dependencies pinned
codependence init rc react lodash

# Legacy: add configuration to package.json with all dependencies pinned
codependence init package

# Create separate Node, Python, Go, Rust, and infrastructure update workflows
codependence init actions
```

The configuration init modes will:

- **Default to permissive mode** (update all dependencies to latest, except those you want to pin)
- Scan your `package.json` for dependencies
- Let you choose your dependency policy strategy:
  - 🚀 **Permissive mode** (default/recommended): Update all to latest, pin specific ones
  - 🔒 **Pin all mode**: Keep all dependencies at current versions
- Recommend `.codependencerc`, with embedded `package.json` configuration retained for legacy projects
- Provide clear next steps for running Codependence
- Handle edge cases like missing files or invalid JSON gracefully

`codependence init actions` reads configured manager targets and generates
scheduled pull request workflows without replacing existing files.

#### Testing

**Unit Tests:**
```sh
bun test                    # Run all unit tests
bun test --coverage        # Run with coverage report
```

**E2E Tests:**
```sh
./tests/e2e/test-multilang.sh all    # Run all e2e tests
./tests/e2e/test-multilang.sh rust
./tests/e2e/test-multilang.sh docker
./tests/e2e/test-multilang.sh github-actions
./tests/e2e/test-multilang.sh uv
./tests/e2e/test-multilang.sh agent-skills
```

---

## Codependence as a CLI

**Codependence** is built as a CLI-first policy tool.

Install **Codependence** as a root `devDependency` and keep repository policy in one root `.codependencerc`.

For monorepos and mixed-language repositories, add manager targets with their own `files`, `rootDir`, and policy fields. The CLI loads the config once and executes every target.

<!-- CLI command and options from src/cli/constants.ts -->

```sh
Usage: codependence [command] [options]

Commands:
  init [type] [items...]            Initialize Codependence
                                    Types: rc, package, default, actions

Options:
  -f, --files [files...]           File glob pattern
  --target [managers...]           Run only selected manager targets
  --version [manager=version...]   Exact tool versions for init actions
  --post-update-command [name=cmd...] Override generated lockfile commands
  --schedule [area=cron...]        Override generated workflow schedules
  --token-secret <name>            GitHub PAT secret name for generated workflows
  --force                           Replace generated workflow files
  --lockfile [policy]              Require lockfiles, or pass false for manifest-only updates
  -u, --update                      Update dependencies based on check
  -r, --rootDir <rootDir>          Root directory to start search
  -i, --ignore [ignore...]         Ignore glob pattern
  --debug                           Enable debugging
  --silent                          Enable mainly silent logging
  -v, --verbose                     Enable verbose logging (shows debug info)
  -q, --quiet                       Suppress all output except errors
  -cds, --codependencies [deps...] Dependencies to check
  -c, --config <config>            Path to a config file
  -s, --searchPath <searchPath>    Path to do a config file search
  -y, --yarnConfig                  Enable yarn config support
  --level <level>                   Update level: patch, minor, or major (default: major)
  -m, --mode <mode>                verbose: only listed packages; precise: all except listed
  -l, --language <lang>            Target language (nodejs, go, python, rust, docker, github-actions)
  -h, --help                        Show this help message
  --dryRun                          Show what would change without modifying files
  --interactive                     Choose which packages to update interactively
  --watch                           Watch for changes and re-check continuously
  --noCache                         Disable version caching for fresh results
  --format <type>                   Output format: json, markdown, or table (default: table)
  --outputFile <path>               Write output to file instead of stdout
```

## Codependence GitHub Action

<!-- generated workflow behavior from src/program.ts -->

Generate the recommended split workflows from the manager targets in
`.codependencerc`:

```sh
codependence init actions
```

This creates at most five stable workflow files for Node, Python, Go, Rust, and
the combined Docker/GitHub Actions area. Existing files are preserved unless
`--force` is provided.

<!-- partial update and pull request inputs from action.yml -->

Run one configured manager target with an exact tool version:

```yaml
- uses: yowainwright/codependence@v1
  with:
    targets: bun
    version: 1.3.14
```

Rust accepts exact stable `x.y.z` toolchains and normalizes an optional leading
`v` before invoking rustup.

Public Docker Hub and GHCR images need no registry inputs. Private images use
repository secrets without placing credentials in `.codependencerc`:

```yaml
- uses: yowainwright/codependence@v1
  with:
    targets: docker
    dockerhub-username: ${{ vars.DOCKERHUB_USERNAME }}
    dockerhub-token: ${{ secrets.DOCKERHUB_TOKEN }}
    ghcr-username: ${{ github.actor }}
    ghcr-token: ${{ secrets.GITHUB_TOKEN }}
```

PR mode requires a fine-grained PAT and `post-update-command`. Each manager set
uses a stable branch, so scheduled Bun, Go, Rust, uv, and infrastructure
workflows maintain separate pull requests while repeated runs update the
existing PR. See the [GitHub Action guide](.github/ACTION.md) for lockfile
policy and PAT permissions.

## Codependence in Node

Although **Codependence** is built primarily as a CLI utility, it can be used as a Node utility.

```ts
import { checkFiles, codependence } from "codependence";

const checkForOutdated = async () => {
  try {
    await checkFiles({ codependencies: ["fs-extra", "lodash"] });
    console.log("All dependencies are up-to-date");
  } catch (err) {
    console.error("Dependencies are out of date:", (err as Error).message);
  }
};

const updateAllExceptSpecific = async () => {
  await codependence({
    codependencies: ["react", "lodash"],
    permissive: true,
    update: true,
  });
};

checkForOutdated();
```

### 0.3.1 compatibility

The v1 CLI keeps the final pre-1.0 contract from `0.3.1`: the `codependence`
and `cdp` binaries, legacy CLI flags, flat and embedded `package.json` policy,
and listed-only `codependencies` behavior. The named `script` export retains
the legacy non-throwing API. Use `checkFiles` or `codependence` when callers
need v1 errors and version-diff results.

## Configuration Options

`.codependencerc` is the primary configuration surface. Keep manager policies in the file and use CLI flags for execution choices such as checking, updating, or formatting output.

---

### One `.codependencerc`, every manager

<!-- manager target config shape from src/types.ts and src/config/index.ts -->

The root `targets` array holds independent manager policies. Each target uses
manager-scoped default manifests unless `files` is provided, plus its own
policy and version resolver. Codependence runs all targets from the same
config.

```json
{
  "lockfile": true,
  "targets": [
    {
      "manager": "bun",
      "files": ["package.json"],
      "codependencies": ["typescript"]
    },
    {
      "manager": "github-actions",
      "files": ["action.yml", ".github/workflows/*.yml"],
      "mode": "precise"
    }
  ]
}
```

Supported managers are `bun`, `npm`, `pnpm`, `yarn`, `conda`, `pip`,
`pipenv`, `poetry`, `uv`, `go`, `rust`, `docker`, and `github-actions`.
Execution options such as `update`, `dryRun`, `format`, and `noCache` stay at
the root and apply to every target. Root `rootDir` and `ignore` values are also
inherited unless a target overrides them. Root `lockfile` is inherited and can
be disabled for one target with `"lockfile": false`. Use `--target bun` or
`--target go` to run only configured targets for those managers. Legacy flat and embedded
`package.json` configurations remain supported, but new projects should use
`.codependencerc`. Target-scoped fields cannot be mixed beside `targets`.

---

### `codependencies`: `Array<string | Record<string, string>`

`codependencies` is a target-scoped policy array. String entries track the latest version; object entries pin an exact version or range.

- The default value is `undefined`
- An array is required!

---

### Version policy entries

The Codependence `codependencies` array supports `latest` out-of-the-box.

> So having this `["fs-extra", "lodash"]` will return the `latest` versions of the packages within the array. It will also match a specified version, like so `[{ "foo": "1.0.0" }]` and `[{ "foo": "^1.0.0" }]` or `[{ "foo": "~1.0.0" }]`. You can also include a `*` **at the end** of a name you would like to match. For example, `@foo/*` will match all packages with `@foo/` in the name and return their latest versions. This will also work with `foo-*`, etc.

**Codependence** is built in to give you more capability to control your dependencies!

---

### Legacy embedded monorepo policies

New monorepos should define manager targets in the root `.codependencerc` and scope them with `files` or `rootDir`. Embedded `codependence.codependencies` arrays in child `package.json` files remain supported for compatibility.

#### For example

You can have a `package.json` file in a `@foo/bar` package with following:

```typescript
{
  "name": "@foo/bar",
  "dependencies": {
    "fs-extra": "^9.0.0",
  },
  "codependence": {
    "codependencies": [{ "fs-extra": "^9.0.0" }]
  }
}

```

And another `package.json` file in a `@foo/baz` package with following:

```typescript
{
  "name": "@foo/baz",
  "dependencies": {
    "fs-extra": "^11.1.0",
  },
  "codependence": {
    "codependencies": [{ "fs-extra": "^11.1.0" }]
  }
}

```

Codependencies will install the right dependency version for each package in your monorepo!

> _**Note:** Codependencies can and will still install the expected version defined at the monorepo's root for packages that don't specify differences in their `package.json` files!_

---

### `files`: `Array<string>`

An optional array of manifest or workflow glob patterns for a target.

- The default value is `['package.json']`
- This array accepts glob patterns as well, example `["package.json", "**/package.json"`

---

### `update`: `boolean`

An optional root boolean that applies approved dependency updates across every target.

- The default value is `false`

---

### `rootDir`: `string`

An **optional** string which can used to specify the root directory to run checks from;

- The default value is `"./"`

---

### `ignore`: `Array<string>`

An **optional** array of strings used to specify directories to ignore

- `.git`, `.next`, `.venv`, `node_modules`, and `*.dockerignore` files are ignored by default
- an explicit `ignore` array replaces these defaults for 0.x compatibility
- glob patterns are accepted

---

### `debug`: `boolean`

An **optional** boolean value used to enable debugging output

- The default value is `false`

---

### `silent`: `boolean`

An **optional** boolean value used to enable a more silent developer experience

- The default value is `false`

---

### `config`: `string`

An optional path to an alternate config file. Without it, Codependence searches for `.codependencerc` from the current directory upward.

- The default is `undefined`

---

### `searchPath`: `string`

An **optional** string containing a search path for location config files.

- The default value is `undefined`

### `yarnConfig`: `boolean`

An **optional** boolean value used to enable \***yarn config** checking

- The default value is `false`

---

### `permissive`: `boolean`

Controls whether all dependencies are updated to latest except those listed in `codependencies`.

- The default value is `false` when `codependencies` are provided, for compatibility with 0.x jobs
- When `true`, all dependencies NOT listed in `codependencies` are updated to latest — your `codependencies` list is what you want to **pin**
- Use `--mode precise` (CLI) or `mode: "precise"` (config) for the same pin-and-update-everything-else behavior

---

### `level`: `"patch" | "minor" | "major"`

An **optional** string constraining how far updates are allowed to reach.

- `"patch"` — only update within the same minor version (e.g. `1.2.x`)
- `"minor"` — only update within the same major version (e.g. `1.x.x`)
- `"major"` — allow any update (default)

---

### `mode`: `"verbose" | "precise"`

An **optional** string controlling which packages are checked.

- `"verbose"` — only check/update the packages listed in `codependencies` (0.x compatible behavior)
- `"precise"` — update all dependencies except those listed in `codependencies` (same as permissive behavior)

---

### `dryRun`: `boolean`

An **optional** boolean that previews what would change without modifying any files.

- The default value is `false`

---

### `interactive`: `boolean`

An **optional** boolean that prompts you to select which packages to update when combined with `--update`.

- The default value is `false`

---

### `watch`: `boolean`

An **optional** boolean that enables continuous checking, re-running every 30 seconds.

- The default value is `false`

---

### `noCache`: `boolean`

An **optional** boolean that bypasses the version cache for fresh registry results.

- The default value is `false`

---

### `format`: `"json" | "markdown" | "table"`

An **optional** string specifying the output format. When set, disables the spinner and outputs structured data instead.

- `"json"` — machine-readable JSON
- `"markdown"` — Markdown table (useful for PR comments)
- `"table"` — formatted table (default when flag is used)

---

### `outputFile`: `string`

An **optional** path to write formatted output to a file instead of stdout. Requires `format` to be set.

---

### Multi-language support (experimental)

Declare each ecosystem through a manager target in `.codependencerc`. The
`--language` flag remains available for one-off and legacy single-target runs:

```sh
codependence --language python
codependence --language go
codependence --language rust
codependence --language docker
codependence --language github-actions
```

<!-- provider capabilities from src/providers/*/index.ts -->

The Docker provider supports explicit pins, latest tag resolution, and
`mode: "precise"` for Docker Hub and GHCR images. It selects the highest stable
numeric tag that is at least as specific as the current tag and has its exact
prefix and suffix, so `20-slim` remains in the `-slim` family and `3.19` does
not switch to a date tag. Repeated images with different tag families resolve
independently. `FROM` tags assembled from one Docker `ARG` are resolved and
updated without changing the composition. Digest-pinned images, scratch
stages, unresolved variables, and unsupported registries remain unchanged.
Mutable tags such as `latest` fail rather than guessing a version.

The CLI reads Docker Hub credentials from `DOCKERHUB_USERNAME` and
`DOCKERHUB_TOKEN`. GHCR uses `GHCR_USERNAME` and `GHCR_TOKEN`. Both values are
required for authenticated registry access. The GitHub Action falls back to its
workflow token for private GHCR packages and retries anonymously when GHCR
rejects that token for a public package. Docker Hub PATs should be read-only;
private GHCR packages require `read:packages` access.

The GitHub Actions provider supports explicit pins, latest release resolution,
and `mode: "precise"`. Latest versions resolve to immutable commit SHAs, and
existing version comments are refreshed with the release tag. Local and Docker
actions remain unchanged. Authenticated lookups use `GITHUB_TOKEN` or `GH_TOKEN`
when available.

Non-Node providers remain experimental, but stable and experimental managers
can share the same `targets` array.

Python requirements updates preserve comments, markers, hashes, and include
directives. Unversioned and URL-based requirements are left unchanged. After
updating manifests, regenerate and commit ecosystem lockfiles with their native
package managers.

---

## Recipes

Listed below are some common patterns (recipes) for using **Codependence**.

### One-off checks without `.codependencerc`

CLI policy flags remain available for temporary checks and scripts that do not need a repository policy.

```sh
codependence --codependencies 'lodash' '{ \"fs-extra\": \"10.0.1\" }'
```

### Want to grab all dependencies which match a `<name>*` (name star) pattern to return the latest version of them? Sure!

```sh
codependence --codependencies '@foo/*' --update
```

### Want to update all dependencies to latest except specific ones?

Use permissive mode and list what you want to pin:

```sh
codependence --permissive --codependencies 'react' 'lodash' --update
```

---

## Synopsis

Codependence is a dependency-policy CLI that loads one `.codependencerc` and checks each configured manager against its manifests, images, or workflow references.

For each dependency included in the `codependencies` array, Codependence will either **a)** check that versions are at `latest` or **b)** check that a specified version is matched within manifest files. Codependence can either **a)** return a pass/fail result _or_ **b)** update dependency versions in manifest file(s).

---

Codependence is useful for ensuring important dependency versions are intentional: up-to-date where they should move, pinned where they should not, and consistent across a repo or monorepo.

This utility is built to work alongside dependency automation tools like [Dependabot](https://dependabot.com/) and [Renovate](https://docs.renovatebot.com/). Use those tools for hosted dependency PR automation. Use Codependence for local checks, CI gates, scripted updates, and repo-specific version policy.

---

## Policy Surface

Codependence currently focuses on package manifests and dependency sections. The same policy model can expand to other version surfaces over time.

| Surface | Status | Purpose |
| --- | --- | --- |
| `package.json` dependencies | Supported | Enforce dependency policy in Node.js projects and monorepos |
| Python, Go, and Rust manifests | Experimental | Apply the same check/update workflow outside Node.js |
| Dockerfiles | Experimental | Check base image versions |
| GitHub Actions workflows | Experimental | Check action refs in workflow YAML |
| Local repository scans | Roadmap | Report drift across a directory of projects, such as `~/code` |
| Toolchain files | Roadmap | Keep `.nvmrc`, `.node-version`, `.tool-versions`, and `.mise.toml` aligned |
| Compose and other CI YAML | Roadmap | Check service images, actions, and runtime versions in pipeline files |

---

#### Codependencies are project dependencies that must stay current or match a specified version.

When a manifest cannot use `latest` directly, Codependence writes the resolved version required by the target's policy. Exact versions and supported ranges remain explicit in `.codependencerc`.

---

## Why use Codependence?

**Codependence** is focused on one job: enforcing dependency version policy where your code actually runs.

- It gives teams a small, explicit policy for versions that must stay current or pinned.
- It can fail CI when dependency versions drift.
- It can update only listed packages, or update everything except listed packages.
- It manages multiple dependency managers and monorepo scopes from one `.codependencerc`.
- It runs locally, from npm scripts, in GitHub Actions, or in other CI providers.
- It exposes a Node API for custom workflows and internal tooling.

---

## Why _not_ use Codependence?

**Codependence** isn't for everybody or every repository. Here are some reasons why it _might not_ be for you!

- You only need hosted dependency PRs and are happy with Dependabot or Renovate.
- You do not need local or CI enforcement for version drift.
- You prefer manually pinning versions without automated checks.
- You do not need package-specific or workspace-specific dependency policy.

---

## Demos

Check out Codependence in Action!

- **[Codependence Cron](https://github.com/yowainwright/codependence-cron):** Codependence running off a GitHub Action cron job.
- **[Codependence Monorepo](https://github.com/yowainwright/codependence-monorepo):** Codependence monorepo example.

---

## Codependence Debugging

### `private packages`

If there is a `.npmrc` file, there is no issue with **Codependence** monitoring private packages. However, if a yarn config is used, Codependence must be instructed to run `version` checks differently.

---

### Fixes

- With the CLI, add the `--yarnConfig` option.
- With node, add `yarnConfig: true` to your options or your config.
- For other private package issues, submit an [issue](https://github.com/yowainwright/codependence/issues) or [pull request](https://github.com/yowainwright/codependence/pulls).

---

## Development Environment

This project uses:

- Node.js 20, 22, or 24 in CI; releases run on Node.js 24
- Bun 1.3.14

We use [mise](https://mise.jdx.dev/) to manage tool versions. If you have mise installed, it will automatically use the correct versions of Node.js and bun.

### Setup with mise

```sh
# Install mise if you don't have it
curl https://mise.run | sh

# Clone the repository
git clone https://github.com/yowainwright/codependence.git
cd codependence

# mise will automatically use the correct versions from .mise.toml
mise install

# Install dependencies
bun install
```

### Setup without mise

```sh
# Install Node.js 24
nvm install 24

# Install pinned bun
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"

# Install dependencies
bun install
```

## Release Strategy

<!-- release flow from scripts/release.ts and .github/workflows/publish.yml, test-release.yml, and homebrew.yml -->

Git tags must match `package.json` versions. Stable tags like `v1.0.0` publish
to npm `latest`. Supported prerelease tags use `alpha`, `beta`, or `rc`, such as
`v1.0.0-beta.1`, and publish to the matching npm dist-tag.

Local release helpers keep the release commit and the publish trigger composable:

```sh
bun run release:dry
bun run release:alpha:dry
bun run release:beta:dry
bun run release:rc:dry
bun run release
bun run release:tag
```

The release helper creates the release commit locally, pushes only the version tag,
and restores local `main` to its starting commit. The tag triggers the publish
workflow, which packs the npm tarball and then compiles `codependence-linux-x64`
with Perry. The standalone executable must pass its help check plus Docker,
GitHub Actions, and Rust provider E2E tests before npm publication. The workflow
attests both artifacts, publishes the package with npm provenance, and uploads
the executable, tarball, and attestation to the GitHub release. It then runs the
reusable published-package test suite against the exact npm version before the
release is considered successful.
Use `bun run release:tag` when `package.json` already has the version you want
to publish.

Perry is exact-pinned because newer releases currently fail the native link.
Only update that pin after `bun run test:e2e:binary` passes on macOS and Ubuntu
24.04 x64.

Publishing follows the same posture as Pastoralist: GitHub Actions publishes
through npm Trusted Publishing/OIDC, not a long-lived npm token. Configure the
`codependence` package on npm with a trusted publisher for
`yowainwright/codependence`, workflow file `publish.yml`, environment
`npm-publish`, and allowed action `npm publish`. After the trusted publisher is
working, npm package settings should require 2FA and disallow token publishing.

### npm rollback

npm versions are immutable. Roll back a bad stable release by restoring the
last known-good `latest` tag and deprecating the bad version instead of
unpublishing it:

```sh
GOOD_VERSION=1.0.1
BAD_VERSION=1.1.0

npm dist-tag add "codependence@$GOOD_VERSION" latest
npm deprecate "codependence@$BAD_VERSION" "Deprecated after release validation failed. Use codependence@$GOOD_VERSION."
npm view codependence dist-tags --json
npm view codependence@latest version
```

Keep the failed GitHub release and provenance assets available for auditability,
and add a warning that points users to the last known-good version.

### Homebrew release

Prepare Homebrew only after the stable npm package and GitHub release exist:

```sh
gh workflow run homebrew.yml -f version=1.1.0
```

The workflow downloads the published npm tarball, computes its SHA256, installs
the generated formula through a temporary tap, runs both `codependence --help`
and `cdp --help`, and attaches `codependence.rb` to the matching GitHub release.
Publish that verified file as `Formula/codependence.rb` in
`yowainwright/homebrew-tap`; do not derive the formula SHA from a local pack.

## Contributing

[Contributing](.github/CONTRIBUTING.md) is straightforward.

### Issues

- Sprinkle some context
- Can you submit a pull request if needed?

### Pull Requests

- Add a test (or a description of the test) that should be added
- Update the readme (if needed)
- Sprinkle some context in the [pull request](.github/PULL_REQUEST_TEMPLATE.md).
- Hope it's fun!

Thank you!

---

## Roadmap

- **Policy Surface:**
  - scan a directory of local repositories and report version drift
  - extend policy checks beyond package manifests to toolchain files such as `.nvmrc`, `.node-version`, `.tool-versions`, and `.mise.toml`
  - extend Docker image version checks beyond `Dockerfile` to `Containerfile` and compose files
  - extend CI pipeline version checks beyond GitHub Actions to other workflow YAML
- **Code:**
  - add better spying/mocking (in progress)
  - add utils functions to be executed with the cli cmd (monorepo, cadence, all deps)
- **Demo Repos**
  - **monorepo:** present how **codependence** can work to support monorepo updates (in progress)
  - **cadence:** present how cadence can be implemented with **codependence**
- **Documentation**
  - write recipes section after the demo repos are complete (in progress)

---

## Shoutouts

Thanks to [Dev Wells](https://github.com/devdumpling) and [Steve Cox](https://github.com/stevejcox) for the aligned code leading to this project. Thanks [Navid](https://github.com/NavidK0) for some great insights to improve the api!

---

Made by [@yowainwright](https://github.com/yowainwright), MIT 2022-present
