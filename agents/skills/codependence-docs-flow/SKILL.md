---
name: codependence-docs-flow
description: Build, migrate, and maintain the Codependence documentation site flow. Use when Codex works on page/app, removes Astro, ports docs to Vite React, reuses components from ../pastoralist/app/src, updates MDX/content routing, preserves the /codependence static base path, or improves docs navigation/search/theme/demo flows with Effect and XState.
---

# Codependence Docs Flow

## Overview

Use this skill to keep Codependence docs work aligned with the Pastoralist app architecture while preserving Codependence branding and a static GitHub Pages deployment.

## Target Shape

- Use Vite + React instead of Astro.
- Preserve the `page/app` workspace and `/codependence` base path.
- Reuse or adapt components from `../pastoralist/app/src` when they fit.
- Match Pastoralist layout quality and interaction patterns, but do not copy its color palette.
- Do not add tRPC unless a real server/API deployment exists.
- Use XState for meaningful UI flow state such as drawer/search/docs-loading/demo states.
- Use Effect for typed async/content pipelines or validation where it reduces branching and error handling.

## Migration Workflow

1. Inventory existing Astro pages, layouts, components, MDX content, assets, and route slugs.
2. Inspect the corresponding Pastoralist app files before copying patterns:

```text
../pastoralist/app/src/main.tsx
../pastoralist/app/src/routes.tsx
../pastoralist/app/src/content/index.ts
../pastoralist/app/src/layouts
../pastoralist/app/src/components
../pastoralist/app/vite.config.ts
```

3. Replace Astro-specific files with React equivalents and a Vite config.
4. Convert Astro layouts/components to TSX or adapt Pastoralist TSX components.
5. Keep MDX frontmatter discoverable from a typed content index.
6. Keep docs route URLs stable at `/docs/<slug>`.
7. Update package scripts and dependencies so no Astro packages remain.
8. Build and browser-verify the app at the configured base path.

## Design Rules

- Use icons from `lucide-react` for icon buttons.
- Keep controls compact and stable; do not let labels or dynamic state resize fixed UI.
- Avoid decorative card nesting and marketing-only sections; build the actual docs/product flow.
- Do not use Pastoralist colors directly. Define Codependence-specific theme tokens.
- Keep text readable on mobile and desktop; verify no toolbar/sidebar/search text overlaps.
- Preserve Codependence assets from `page/app/public` unless replacing them is intentional.

## Verification

Run the relevant workspace commands after changes:

```bash
bun run --cwd page/app build
bun run docs:build
bun run typecheck
bun run lint
```

Start a local dev server and inspect with Browser after substantial frontend changes.
