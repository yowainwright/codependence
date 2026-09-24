# Agent Rules

This tool aims to provide a precise way to dependency management in a maintainable way that allows controlled editing. There should be no custom code. Anything custom should be evidence-backed with source links.

- Do not create files or directories before checking whether they already exist.
- Do not stage, commit, push, deploy, or publish unless explicitly asked.
- Do not write tests for new features until a human has reviewed and approved the feature, unless explicitly using TDD.
- Keep architecture notes in `tmp/*.md` aligned before commit-ready work.
- No snowflakes. All code should follow a clear pattern from the established tools we use.

## Communication Style

- Teach before acting: give a small amount of context with cited evidence.
- Be terse. No preamble, request-parroting, sign-offs, or obvious next steps.
- State uncertainty plainly. Do not fake confidence.
- Before editing, name the exact source, file, tool, API, or pattern being used.
- If the default path is unclear, ask one precise question instead of listing options.
- If the user pushes back, use a short grill: 2 focused questions max.

## Core Defaults

- For app UI, use real shadcn components wherever possible. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- React Flow canvas and controls are allowed only as wrappers around shadcn blocks.
- All app state belongs in XState. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- Utilities should use Effect. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- CRUD should be a direct handoff between XState and Dexie. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- Prefer oxlint with oxlint-plugin-legibility in strict mode.

## Stop Conditions

- Before editing, name the exact default tool/API/component/pattern being used.
- If you cannot name it, do not edit.
- Ask: "I'm at `<file/component>`, implementing `<specific behavior>`. Which `<specific default API/component/pattern>` should I use?"
- Ask one buffer question only after the default path is exhausted.
- Do not invent wrappers, one-off controls, bespoke CSS, or new architecture.
# Agent Rules

This tool aims to provide a precise way to convert Mermaid to React Flow in a maintainable way that allows controlled editing. There should be no custom code. Anything custom should be evidence-backed with source links.

- Do not create files or directories before checking whether they already exist.
- Do not stage, commit, push, deploy, or publish unless explicitly asked.
- Do not write tests for new features until a human has reviewed and approved the feature, unless explicitly using TDD.
- Keep architecture notes in `tmp/*.md` aligned before commit-ready work.
- No snowflakes. All code should follow a clear pattern from the established tools we use.

## Communication Style

- Teach before acting: give a small amount of context with cited evidence.
- Be terse. No preamble, request-parroting, sign-offs, or obvious next steps.
- State uncertainty plainly. Do not fake confidence.
- Before editing, name the exact source, file, tool, API, or pattern being used.
- If the default path is unclear, ask one precise question instead of listing options.
- If the user pushes back, use a short grill: 2 focused questions max.

## Core Defaults

- For app UI, use real shadcn components wherever possible. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- React Flow canvas and controls are allowed only as wrappers around shadcn blocks.
- All app state belongs in XState. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- Utilities should use Effect. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- CRUD should be a direct handoff between XState and Dexie. If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- Prefer oxlint with oxlint-plugin-legibility in strict mode.

## Stop Conditions

- Before editing, name the exact default tool/API/component/pattern being used.
- If you cannot name it, do not edit.
- Ask: "I'm at `<file/component>`, implementing `<specific behavior>`. Which `<specific default API/component/pattern>` should I use?"
- Ask one buffer question only after the default path is exhausted.
- Do not invent wrappers, one-off controls, bespoke CSS, or new architecture.
