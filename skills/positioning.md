# Skill: Positioning

What makes codependence distinct, and what that means for how you build it.

---

## The core idea

Most dependency tooling works in one of two modes:

- **Update everything** — run an upgrade command and everything moves to latest
- **Block everything** — pin all versions and manually decide when to bump

Codependence occupies the space between them: **pin what matters, update everything else automatically**.

The `codependencies` array is a blocklist, not a whitelist. You name the packages you want to hold back. Everything else moves to latest on its own. This is permissive mode, and it is the default.

```json
{
  "codependencies": ["react", "typescript"]
}
```

This says: keep react and typescript pinned. Update lodash, date-fns, eslint, and everything else freely.

---

## Why this matters

The problem it solves is real: large projects often have a few packages that require careful version alignment — framework versions, peer-dependency chains, packages with breaking changes across minor bumps — while most of their dependencies are safe to update continuously.

Treating all dependencies the same creates two bad outcomes:
1. Update everything → something breaks because of a poorly-tested new version
2. Pin everything → security patches and bug fixes pile up unreviewed

Codependence makes the distinction explicit and automatable.

---

## The human model

Codependence is a **tool, not a bot**. It runs when you run it — in a script, a CI step, a cron job, a git hook. It does not open pull requests. It does not comment on issues. It does not make decisions.

This is intentional. The value is in giving humans precise, auditable control over dependency state, not in automating decisions away from them.

Features that belong here:
- Checking whether deps match their expected versions
- Updating deps to the correct versions on demand
- Reporting what changed and what was skipped
- Integrating cleanly into existing CI/CD pipelines

Features that do not belong here:
- Opening pull requests automatically
- Security vulnerability scanning
- Changelog analysis
- Scheduling or orchestration

---

## Monorepo support is a first-class feature

Each package in a monorepo can have its own `codependencies` config. A package that needs `react@17` can pin it while the rest of the monorepo runs `react@18`. This is not a workaround — it is the intended use case.

When building anything related to file traversal, version resolution, or output formatting, monorepos are the primary scenario to test against.

---

## Package manager agnosticism

Codependence works with npm, yarn, pnpm, and bun. It does not prefer one over another. When a feature touches how versions are resolved or how commands are run, it must work across all four.

---

## The right improvement

Before building a new feature, ask: does this give users more control over which dependencies stay pinned and which update freely? Does it make that control more precise, more visible, or easier to integrate?

If the answer is yes, it fits. If it moves codependence toward automation, opinion, or scope expansion, it probably belongs in a separate tool or workflow layer that sits on top of codependence.
