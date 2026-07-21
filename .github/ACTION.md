# Codependence GitHub Action

Use Codependence in GitHub Actions to enforce every manager policy from the repository's root `.codependencerc`. The action discovers that file automatically and can optionally update mismatched manifests.

## Quick Start

Commit `.codependencerc`, then run the action without repeating policy in workflow YAML:

```yaml
name: Check Dependencies
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
```

## Generate split workflows

<!-- generated workflow behavior from src/program.ts -->

After defining manager targets in `.codependencerc`, generate scheduled pull
request workflows:

```sh
codependence init actions
```

The command creates at most four stable files:

- `.github/workflows/codependence-node.yml`
- `.github/workflows/codependence-python.yml`
- `.github/workflows/codependence-go.yml`
- `.github/workflows/codependence-infrastructure.yml`

Node package managers share one workflow, and Docker plus GitHub Actions share
the infrastructure workflow. Each file runs on a different weekday and updates
one stable pull request branch.

Exact versions are read from `package.json#packageManager`, `go.mod`,
`mise.toml`, `.mise.toml`, `.tool-versions`, or `versions.env`. Supply anything
missing explicitly:

```sh
codependence init actions --version uv=0.8.0
```

Limit generation or override repository-specific settings:

```sh
codependence init actions \
  --target go \
  --post-update-command 'go=task go:tidy' \
  --schedule 'go=30 7 * * 5'
```

Schedule keys are `node`, `python`, `go`, and `infrastructure`.
Post-update commands accept either an area or manager name.

The default secret name is `CODEPENDENCE_TOKEN`; change it with
`--token-secret`. Existing generated workflow files are never replaced unless
`--force` is passed.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `codependencies` | Space-separated dependencies to check | No | - |
| `config` | Path to an alternate config file; root `.codependencerc` is auto-discovered | No | - |
| `files` | File glob patterns (space-separated) | No | - |
| `targets` | Configured manager targets to run | No | - |
| `version` | Exact tool version; use `manager=version` pairs when combining versioned managers | With a versioned target | - |
| `lockfile` | Require lockfiles for selected targets | No | `true` |
| `pull-request` | Create or update a pull request | No | `false` |
| `token` | Fine-grained PAT used for pull requests | In PR mode | - |
| `post-update-command` | Trusted lockfile regeneration command | In PR mode | - |
| `draft` | Create a draft pull request | No | `false` |
| `branch-prefix` | Stable pull request branch prefix | No | `update-dependencies` |
| `update` | Update dependencies | No | `false` |
| `dryRun` | Preview changes without modifying files | No | `false` |
| `permissive` | Update all except pinned | No | `false` |
| `mode` | Policy mode: `verbose` or `precise` | No | - |
| `level` | Allowed update level: `patch`, `minor`, or `major` | No | - |
| `language` | Target language: `nodejs` (stable), or experimental `go`, `python`, `rust`, `docker`, `github-actions` | No | - |
| `fail-on-outdated` | Fail if outdated | No | `true` |
| `rootDir` | Root directory | No | - |
| `ignore` | Ignore patterns (space-separated) | No | - |
| `silent` | Silent logging | No | `false` |
| `debug` | Debug logging | No | `false` |
| `yarnConfig` | Yarn config support | No | `false` |
| `noCache` | Disable version cache | No | `false` |
| `format` | Output format: `json`, `markdown`, or `table` | No | - |
| `outputFile` | Write formatted output to a file | No | - |

## Outputs

| Output | Description |
|--------|-------------|
| `outdated` | Whether dependencies were outdated (`true`/`false`) |
| `pull-request-url` | Created or updated pull request URL |

## Experimental Language Providers

Node.js package manifests are the stable default. The `go`, `python`, `rust`,
`docker`, and `github-actions` providers are experimental while their manifest
coverage and update semantics settle.

<!-- provider capabilities from src/providers/*/index.ts -->

Docker requires explicit object pins in verbose mode. GitHub Actions supports
explicit pins, latest release resolution, and precise mode. Latest releases are
pinned by immutable commit SHA. The action passes its GitHub token to
Codependence for authenticated version lookups.

## Examples

### Check repository policy

```yaml
- uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
```

### Update dependencies

```yaml
- uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
  with:
    update: true
```

### Alternate config path

```yaml
- uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
  with:
    config: 'config/dependency-policy.json'
```

### Python, Go, and other managers

Add each manager to the root `.codependencerc`. Use `targets` to run only the
requested manager policies. One invocation with multiple managers creates one
atomic update and, in PR mode, one pull request.

Root `rootDir` and `ignore` inputs apply to every target unless that target
overrides them. Generated `.git`, `.next`, `.venv`, and `node_modules` content
is ignored automatically. An explicit `ignore` input replaces those defaults.

### Multiple managers in one config

<!-- manager target config shape from src/types.ts and src/config/index.ts -->

`.codependencerc`:

```json
{
  "lockfile": true,
  "targets": [
    {
      "manager": "bun",
      "files": ["**/package.json"],
      "mode": "precise"
    },
    {
      "manager": "go",
      "files": ["**/go.mod"],
      "mode": "precise"
    },
    {
      "manager": "uv",
      "files": ["**/pyproject.toml"],
      "mode": "precise"
    },
    {
      "manager": "docker",
      "mode": "verbose",
      "codependencies": [{ "node": "24-slim" }]
    },
    {
      "manager": "github-actions",
      "mode": "precise"
    }
  ]
}
```

```yaml
- uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
  with:
    targets: go
    version: 1.24.5
```

The Action installs exact Bun, npm, pnpm, Yarn, Go, or uv versions for selected
targets. Docker and GitHub Actions targets do not accept `version`. Docker
`ARG`-backed image tags are updated through their default value. Unversioned or
URL-based Python requirements remain skipped.

### Create a pull request

PR mode only runs from `schedule` or `workflow_dispatch`. Create a fine-grained
PAT for the repository, grant **Contents: Read and write** and **Pull requests:
Read and write**, then store it as `CODEPENDENCE_TOKEN`. Add **Workflows: Read
and write** when a selected target updates `.github/workflows`.

```yaml
name: Update Go dependencies
on:
  schedule:
    - cron: "0 9 * * 2"
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
        with:
          targets: go
          version: 1.24.5
          pull-request: true
          token: ${{ secrets.CODEPENDENCE_TOKEN }}
          post-update-command: go mod tidy
```

The stable branch is `update-dependencies/go`, so every Go run updates the same
open pull request. Bun, Go, uv, and `docker github-actions` invocations use
different branches and therefore maintain separate pull requests. If multiple
managers are intentionally passed together, they produce one pull request:

```yaml
with:
  targets: |
    bun
    go
  version: |
    bun=1.3.14
    go=1.24.5
```

Set `lockfile: false` to allow a manifest-only update. Otherwise every selected
package-manager target must have its standard or configured lockfile before any
manifest is edited. The required `post-update-command` must regenerate and
validate files for the selected managers; repository PR checks should perform
the full test suite.

### Use output in conditional

```yaml
- uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
  id: check
  with:
    fail-on-outdated: false

- if: steps.check.outputs.outdated == 'true'
  run: echo "Dependencies are outdated!"
```

## See Also

- [Main README](README.md)
- [Configuration Options](https://codependence.dev/options)
- [Example Workflows](.github/workflows/example-codependence.yml.example)
