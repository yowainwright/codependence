# Codependence GitHub Action

Use Codependence in your GitHub Actions workflows to enforce dependency version policy and optionally update mismatched manifests.

## Quick Start

```yaml
name: Check Dependencies
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: yowainwright/codependence@v1
        with:
          permissive: true
          codependencies: 'react lodash'
```

## Inputs

<!-- inputs from action.yml -->

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `codependencies` | Space-separated dependencies to check | No | - |
| `config` | Path to config file | No | - |
| `files` | File glob patterns (space-separated) | No | - |
| `update` | Update dependencies | No | `false` |
| `dryRun` | Preview changes without modifying files | No | `false` |
| `permissive` | Update all except pinned | No | `false` |
| `mode` | Policy mode: `verbose` or `precise` | No | - |
| `level` | Allowed update level: `patch`, `minor`, or `major` | No | - |
| `language` | Target language: `nodejs`, `go`, `python`, `rust`, `docker`, or `github-actions` | No | - |
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

## Examples

### Check only (fail on outdated)

```yaml
- uses: yowainwright/codependence@v1
  with:
    permissive: true
    codependencies: 'react lodash'
    fail-on-outdated: true
```

### Update dependencies

```yaml
- uses: yowainwright/codependence@v1
  with:
    update: true
    permissive: true
    codependencies: 'react @types/node'
```

### Monorepo with config

```yaml
- uses: yowainwright/codependence@v1
  with:
    config: '.codependencerc'
    files: 'package.json **/package.json'
```

### Multi-language

```yaml
- uses: yowainwright/codependence@v1
  with:
    language: python
    config: '.codependencerc'
```

```yaml
- uses: yowainwright/codependence@v1
  with:
    language: rust
    config: '.codependencerc'
```

```yaml
- uses: yowainwright/codependence@v1
  with:
    language: docker
    config: '.codependencerc'
```

```yaml
- uses: yowainwright/codependence@v1
  with:
    language: github-actions
    config: '.codependencerc'
```

```yaml
- uses: yowainwright/codependence@v1
  with:
    language: go
    config: '.codependencerc'
```

### Update and commit

```yaml
- uses: yowainwright/codependence@v1
  with:
    update: true
    permissive: true
    codependencies: 'react'

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
    permissive: true
    fail-on-outdated: false

- if: steps.check.outputs.outdated == 'true'
  run: echo "Dependencies are outdated!"
```

## See Also

- [Main README](README.md)
- [Configuration Options](https://codependence.dev/options)
- [Example Workflows](.github/workflows/example-codependence.yml.example)
