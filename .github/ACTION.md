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
      - uses: yowainwright/codependence@v1
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
- uses: yowainwright/codependence@v1
```

### Update dependencies

```yaml
- uses: yowainwright/codependence@v1
  with:
    update: true
```

### Alternate config path

```yaml
- uses: yowainwright/codependence@v1
  with:
    config: 'config/dependency-policy.json'
```

### Python, Go, and other managers

Add each manager to the root `.codependencerc`. The same action invocation runs
all configured targets.

### Multiple managers in one config

<!-- manager target config shape from src/types.ts and src/config/targets.ts -->

`.codependencerc`:

```json
{
  "targets": [
    {
      "manager": "bun",
      "files": ["package.json"],
      "mode": "precise"
    },
    {
      "manager": "github-actions",
      "files": ["action.yml", ".github/workflows/*.yml"],
      "mode": "precise"
    }
  ]
}
```

```yaml
- uses: yowainwright/codependence@v1
  with:
    update: true
```

### Update and commit

```yaml
- uses: yowainwright/codependence@v1
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
- uses: yowainwright/codependence@v1
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
