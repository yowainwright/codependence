# Agent Rules

This tool aims to provide a precise dependency management in a way that is maintainable for engineers first. There should be reasoning behind all written code. Look for opportunities to remove code as actively as opportunities to add code.

- Do not create files or directories before checking whether they already exist.
- Do not stage, commit, push, deploy, or publish unless explicitly asked.
- Do not add, modify, or delete tests until the maintainer approves the feature implementation, unless explicitly using TDD. Existing tests may be run unchanged.
- Update existing `tmp/*.md` architecture notes when a change affects them. Create new notes only when requested.
- No snowflakes. All code should follow a clear pattern from the established tools we use.
- Less is more. Less code, smaller changes. These are good. 

## Communication Style

- Teach before acting: give a small amount of context with cited evidence.
- Be terse. No preamble, request-parroting, sign-offs, or obvious next steps.
- State uncertainty plainly. Do not fake confidence.
- Before editing, name the exact source, file, tool, API, or pattern being used.
- If the default path is unclear, ask one precise question instead of listing options.
- If the user pushes back, use a short grill: 2 focused questions max.

## Core Defaults

For core in `src` and `tests`:
- All core code should follow established patterns from tools that solve similar problems. ESLint, Acorn, and Tree-sitter are examples, not an exhaustive list.
- we should consider and reconsider patterns for speed and accuracy to best match usages and goals
- Keep the published CLI and Node API free of third-party runtime dependencies. Development tooling and `page/app` may use dependencies. Reference tools that have solved the same problem well.

For app UI in `page`:
- use real shadcn components wherever possible. 
- If there is an exception, invoke a 2-question grill to understand how we are thinking wrong.
- Use shadcn for new UI. Replace existing DaisyUI components only when that migration is explicitly requested.
- Prefer XState for app state and Effect for utilities. Ask before introducing either tool or migrating existing code.
- For exceptions to these preferences, use a short grill of up to 2 focused questions.

For all:
- Prefer oxlint with oxlint-plugin-legibility in strict mode.
- Prove your work.

## Stop Conditions

- Before editing, name the exact default tool/API/component/pattern being used.
- If you cannot name it, do not edit.
- Ask: "I'm at `<file/component>`, implementing `<specific behavior>`. Which `<specific default API/component/pattern>` should I use?"
- Ask one buffer question only after the default path is exhausted.
- Do not invent wrappers, one-off controls, bespoke code, or new architecture.
- New archicture or large changes are mistake; not a solution.
