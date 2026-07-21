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

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `codependencies` | Space-separated dependencies to check | No | - |
| `config` | Path to an alternate config file; root `.codependencerc` is auto-discovered | No | - |
| `files` | File glob patterns (space-separated) | No | - |
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

Add each manager to the root `.codependencerc`. The same action invocation runs
all configured targets.

Root `rootDir` and `ignore` inputs apply to every target unless that target
overrides them. Generated `.git`, `.next`, `.venv`, and `node_modules` content
is ignored automatically. An explicit `ignore` input replaces those defaults.

### Multiple managers in one config

<!-- manager target config shape from src/types.ts and src/config/targets.ts -->

`.codependencerc`:

```json
{
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
- uses: actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6.4.0
  with:
    go-version: "stable"
    cache: false
- uses: astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b # v8.1.0
- uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
  with:
    fail-on-outdated: true
```

Use check-only mode first. Docker `ARG`-assembled `FROM` values and unversioned
or URL-based Python requirements are currently skipped. For update workflows,
regenerate and commit each ecosystem's lockfiles with its native package manager.
Latest Go, uv, or Rust resolution requires the corresponding provider CLI on
`PATH`; explicit object pins do not.

### Update and commit

```yaml
- uses: yowainwright/codependence@84b52d79ab0cf2430370c27a6a99a18273a1ac68 # v1.0.2
  with:
    update: true

- run: |
    git config --local user.email "action@github.com"
    git config --local user.name "GitHub Action"
    git add package.json
    git diff --staged --quiet || git commit -m "chore: update dependencies"
    git push
```

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
