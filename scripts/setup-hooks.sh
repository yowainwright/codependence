#!/bin/bash

set -e

HOOKS_DIR=".git/hooks"
PRE_COMMIT="$HOOKS_DIR/pre-commit"
POST_CHECKOUT="$HOOKS_DIR/post-checkout"
COMMIT_MSG="$HOOKS_DIR/commit-msg"

if [ ! -d ".git" ]; then
  echo "Error: Not in a git repository"
  exit 1
fi

echo "Setting up git hooks..."

# Check if core.hooksPath is set and reset it if needed
CURRENT_HOOKS_PATH=$(git config --get core.hooksPath 2>/dev/null || echo "")
if [ -n "$CURRENT_HOOKS_PATH" ]; then
  echo "⚠️  Found core.hooksPath set to: $CURRENT_HOOKS_PATH"
  echo "   Resetting to use .git/hooks/ instead..."
  git config --unset core.hooksPath
  echo "✓ Reset core.hooksPath"
fi

mkdir -p "$HOOKS_DIR"

if [ -f "$PRE_COMMIT" ]; then
  echo "pre-commit hook already exists, skipping..."
else
  cat > "$PRE_COMMIT" << 'EOF'
#!/bin/sh
bun run lint
bun run build
bun test
EOF
  chmod +x "$PRE_COMMIT"
  echo "✓ Created pre-commit hook"
fi

if [ -f "$POST_CHECKOUT" ]; then
  echo "post-checkout hook already exists, skipping..."
else
  cat > "$POST_CHECKOUT" << 'EOF'
#!/bin/sh
if git rev-parse --abbrev-ref @{upstream} >/dev/null 2>&1; then
  git pull
fi
bun install
EOF
  chmod +x "$POST_CHECKOUT"
  echo "✓ Created post-checkout hook"
fi

if [ -f "$COMMIT_MSG" ]; then
  echo "commit-msg hook already exists, skipping..."
else
  cat > "$COMMIT_MSG" << 'EOF'
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
  chmod +x "$COMMIT_MSG"
  echo "✓ Created commit-msg hook"
fi

echo "Git hooks setup complete!"
