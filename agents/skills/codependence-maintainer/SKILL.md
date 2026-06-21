---
name: codependence-maintainer
description: Maintain Codependence repository health. Use when Codex needs to triage or fix Codependence dependency PRs, GitHub code-scanning alerts, Scorecard findings, Socket/pastoralist/codependence security checks, release Dockerfiles, Dependabot configuration, CI workflow dependency updates, or package policy cleanup in the yowainwright/codependence repo.
---

# Codependence Maintainer

## Overview

Use this skill to keep Codependence dependency policy, supply-chain checks, and repo security posture coherent without treating all scanner output as equally actionable.

## Workflow

1. Inspect the current branch and worktree before editing.
2. Query GitHub for open PRs and code-scanning alerts when network access is available:

```bash
gh api repos/yowainwright/codependence/pulls --paginate --jq '.[] | {number,title,head:.head.ref,base:.base.ref,user:.user.login,html_url}'
gh api 'repos/yowainwright/codependence/code-scanning/alerts?state=open' --paginate --jq '.[] | {number,rule:.rule.id,name:.rule.name,severity:.rule.security_severity_level,message:.most_recent_instance.message.text,path:.most_recent_instance.location.path,line:.most_recent_instance.location.start_line,html_url}'
```

3. Separate alerts into code-fixable, repository-setting, and external-program work.
4. Prefer changes that improve `bun run deps:security`, CI reproducibility, and release smoke tests.
5. Run the narrowest relevant checks first, then broaden before finishing.

## Repo Conventions

- Use Bun, TypeScript, oxlint, oxfmt, and Turbo scripts already defined in `package.json`.
- Use `pastoralist` for dependency cleanup and security policy checks.
- Keep root package changes and docs-app package changes consistent with `workspaces`.
- Keep GitHub Actions pinned to full commit SHAs with version comments.
- Treat Scorecard Code Review and OpenSSF Best Practices alerts as repo/admin process work unless the user explicitly authorizes GitHub settings or badge-program changes.
- For Socket setup, prefer `bunfig.toml` scanner configuration plus CI integration that is non-blocking unless a token/secret is confirmed.

## Common Checks

Use these commands as the baseline, adjusting for the touched files:

```bash
bun run deps:security
bun run typecheck
bun run lint
bun test
bun run build
```

For release Dockerfile or published-release changes, run targeted tests around `scripts/ci/published-release.js` and `tests/unit/scripts/ci/published-release_test.test.ts` before full validation.

## PR Triage

- If the docs app is being migrated off Astro, expect Astro-related Dependabot PRs to be superseded.
- Absorb non-Astro dependency bumps into the main branch when they remain relevant after migration.
- Do not close or merge remote PRs without explicit user direction.
