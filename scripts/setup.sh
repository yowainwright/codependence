#!/bin/sh

set -eu

PROJECT_ROOT="${1:-.}"
CLAUDE_DIR="${CLAUDE_DIR:-.claude}"
CODEX_DIR="${CODEX_DIR:-.codex}"

log() {
  printf '%s\n' "$1"
}

skip_existing() {
  path="${1:?path is required}"
  label="${2:?label is required}"

  [ ! -f "$path" ] || report_existing_file
  [ ! -f "$path" ] || return 0
  replace_broken_symlink

  return 1
}

ensure_git_repo() {
  git rev-parse --git-dir >/dev/null 2>&1 && return

  log "Skipping setup outside a git repository"
  exit 0
}

set_hooks_dir() {
  HOOKS_DIR="${HOOKS_DIR:-$(git rev-parse --git-path hooks)}"
}

reset_hooks_path() {
  hooks_path="$(git config --get core.hooksPath 2>/dev/null || :)"

  [ -n "$hooks_path" ] || return 0

  log "Found core.hooksPath set to: $hooks_path"
  git config --unset core.hooksPath
  log "Reset core.hooksPath"
}

install_pre_commit_hook() {
  path="$HOOKS_DIR/pre-commit"

  managed_pre_commit_hook || return 0

  write_pre_commit_hook
  chmod +x "$path"
  log "Installed pre-commit hook"
}

managed_pre_commit_hook() {
  [ ! -f "$path" ] && return 0
  grep -Eq '^(mise exec -- )?(bun|nub) run lint$' "$path" && return 0
  log "pre-commit hook already exists, skipping..."
  return 1
}

write_pre_commit_hook() {
  cat >"$path" <<'EOF'
#!/bin/sh
set -eu

if ! command -v nub >/dev/null 2>&1 && command -v mise >/dev/null 2>&1; then
  eval "$(mise activate sh)"
fi

nub run lint
nub run build
nub run test
EOF
}

install_post_checkout_hook() {
  path="$HOOKS_DIR/post-checkout"
  skip_existing "$path" "post-checkout hook" && return

  cat >"$path" <<'EOF'
#!/bin/sh
if git rev-parse --abbrev-ref @{upstream} >/dev/null 2>&1; then
  git pull
fi
nub install
EOF
  chmod +x "$path"
  log "Created post-checkout hook"
}

write_commit_msg_hook_template() {
  cat >"$path" <<'EOF'
#!/bin/sh
commit_msg=$(cat "$1")
pattern="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,}"

if ! echo "$commit_msg" | grep -qE "$pattern"; then
  echo "Error: Commit message does not follow conventional commits format"
  echo "Expected: <type>[optional scope]: <description>"
  echo "Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  echo ""
  echo "Your commit message:"
  echo "$commit_msg"
  exit 1
fi

if [ ${#commit_msg} -gt 120 ]; then
  echo "Error: Commit message header exceeds 120 characters"
  exit 1
fi
EOF
} # noqa: LEG038 -- This function only writes a literal configuration template.

install_commit_msg_hook() {
  path="$HOOKS_DIR/commit-msg"
  skip_existing "$path" "commit-msg hook" && return

  write_commit_msg_hook_template
  chmod +x "$path"
  log "Created commit-msg hook"
}

install_git_hooks() {
  mkdir -p "$HOOKS_DIR"
  install_pre_commit_hook
  install_post_checkout_hook
  install_commit_msg_hook
}

write_agents_md_template() {
  cat >AGENTS.md <<'EOF'
# Codependence Docs

For README updates, use the `technical-writing` skill.

Use these style references:

- https://github.com/yowainwright/shellcheck_legibility
- Node.js docs
- Mini Cookies README API section

Document schema, CLI, API, and Action surfaces by execution type: CLI, CI, or Node.

For each approved section:

1. Title with the option or API name in code, including type.
2. Short summary.
3. CLI or CI example when applicable.
4. Output block when the command or Action produces output.

Use `jsonc` for JSON examples and `diff` for changed output or behavior.

Write one section at a time and wait for approval before editing the next section.
EOF
} # noqa: LEG038 -- This function only writes a literal configuration template.

install_agents_md() {
  skip_existing "AGENTS.md" "AGENTS.md" && return

  write_agents_md_template
  log "Created AGENTS.md"
}

install_claude_md() {
  skip_existing "CLAUDE.md" "CLAUDE.md" && return

  cat >CLAUDE.md <<'EOF'
# Codependence Docs

Follow `AGENTS.md` for project-specific documentation work.
EOF
  log "Created CLAUDE.md"
}

write_claude_settings_template() {
  cat >"$path" <<'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "test ! -x \"$HOME/.agents/bin/agent-sync\" || \"$HOME/.agents/bin/agent-sync\" hook git --claude",
            "timeout": 5,
            "statusMessage": "Checking Git permissions"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "test ! -f package.json || nub run lint:agent",
            "timeout": 120,
            "statusMessage": "Checking agent lint"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "test ! -x \"$HOME/.agents/bin/agent-sync\" || \"$HOME/.agents/bin/agent-sync\" hook git --claude --prompt",
            "timeout": 5,
            "statusMessage": "Checking Greploop activation"
          }
        ]
      }
    ]
  }
}
EOF
} # noqa: LEG038 -- This function only writes a literal configuration template.

install_claude_settings() {
  path="$CLAUDE_DIR/settings.json"
  skip_existing "$path" "Claude settings" && return

  mkdir -p "$CLAUDE_DIR"
  write_claude_settings_template
  log "Created Claude settings"
}

install_codex_config() {
  path="$CODEX_DIR/config.toml"
  skip_existing "$path" "Codex config" && return

  mkdir -p "$CODEX_DIR"
  cat >"$path" <<'EOF'
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = false
exclude_slash_tmp = true
exclude_tmpdir_env_var = true
EOF
  log "Created Codex config"
}

write_codex_hooks_template() {
  cat >"$path" <<'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|exec_command",
        "hooks": [
          {
            "type": "command",
            "command": "test ! -x \"$HOME/.agents/bin/agent-sync\" || \"$HOME/.agents/bin/agent-sync\" hook git --codex",
            "timeout": 5,
            "statusMessage": "Checking Git permissions"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "apply_patch|Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "test ! -f package.json || nub run lint:agent",
            "timeout": 120,
            "statusMessage": "Checking agent lint"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "test ! -x \"$HOME/.agents/bin/agent-sync\" || \"$HOME/.agents/bin/agent-sync\" hook git --codex --prompt",
            "timeout": 5,
            "statusMessage": "Checking Greploop activation"
          }
        ]
      }
    ]
  }
}
EOF
} # noqa: LEG038 -- This function only writes a literal configuration template.

install_codex_hooks() {
  path="$CODEX_DIR/hooks.json"
  skip_existing "$path" "Codex hooks" && return

  mkdir -p "$CODEX_DIR"
  write_codex_hooks_template
  log "Created Codex hooks"
}

install_agent_config() {
  install_agents_md
  install_claude_md
  install_claude_settings
  install_codex_config
  install_codex_hooks
}

main() {
  cd "$PROJECT_ROOT"
  ensure_git_repo
  reset_hooks_path
  set_hooks_dir
  log "Setting up git hooks..."
  install_git_hooks
  install_agent_config
  log "Setup complete!"
}

report_existing_file() {
  log "$label already exists, skipping..."
}

replace_broken_symlink() {
  [ -L "$path" ] || return 0
  log "$label symlink does not point to a file, replacing..."
  rm "$path"
}

main "$@"
