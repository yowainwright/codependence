# Security Baseline

## Dependency Policy

Codependence treats dependency policy and dependency security as release-blocking.

- Run `bun run deps:security` before release branches and dependency PR merges.
- Keep GitHub Actions pinned to full commit SHAs with version comments.
- Keep Docker base images pinned by digest.
- Keep intentional vulnerable fixtures isolated to test data or generated runtime files.

## Scanner Surfaces

- CodeQL owns code-scanning SARIF findings.
- OpenSSF Scorecard publishes repository posture results, but those results are not uploaded as code-scanning alerts.
- Bun uses the Socket scanner configured in `bunfig.toml`; set `SOCKET_API_KEY` in CI to use Socket organization policy.

## Review Guidelines

1. Treat production code, the root `package.json`, workspace package manifests, and lockfiles as release-blocking.
2. Investigate committed test manifest alerts when they affect runtime dependencies.
3. Document exceptions in `package.json` dependency policy metadata or in the relevant test fixture.
