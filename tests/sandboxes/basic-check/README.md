# 🤼‍♀️ Basic Codependence Check

This sandbox demonstrates basic [Codependence](https://github.com/yowainwright/codependence) functionality with the new optimized flow and enhanced DX features.

## Setup

```bash
npm install
npm install -g codependence  # or use npx
```

## Commands

### Check dependencies
```bash
npm run check                 # Basic check
npm run check:verbose         # Detailed output with cache info
npm run check:json           # Generate JSON report
npm run check:markdown       # Generate Markdown report
```

### Update dependencies
```bash
npm run update               # Update to latest versions
npm run dry-run             # Preview changes without modifying
```

## Output Reports

After running checks, view the dependency report:
- **JSON Report**: [`dependency-report.json`](./dependency-report.json)
- **Markdown Report**: [`dependency-report.md`](./dependency-report.md)

## Current Setup

This example has intentionally outdated dependencies:
- `lodash@4.17.19` - Has security vulnerabilities (should be 4.17.21)
- `express@4.17.1` - Outdated (current is 4.19.2+)
- `typescript@4.9.0` - Major version behind (current is 5.3+)

## What Codependence Does

1. Checks only packages listed in `codependence.codependencies`
2. Compares local versions against npm registry
3. Reports outdated packages with current versions
4. Can update package.json automatically with `--update`
5. Generates reports in multiple formats (JSON, Markdown, Table)