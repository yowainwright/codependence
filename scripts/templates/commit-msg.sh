#!/bin/sh
set -eu

invalid_message() {
  echo "Error: Commit message does not follow conventional commits format"
  echo "Expected: <type>[optional scope]: <description>"
  echo "Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  echo ""
  echo "Your commit message:"
  echo "$commit_msg"
  exit 1
}

message_too_long() {
  echo "Error: Commit message header exceeds 120 characters"
  exit 1
}

main() {
  message_file="${1:?commit message file is required}"
  commit_msg=$(cat "$message_file")
  pattern="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\\(.+\\))?: .{1,}"
  printf '%s\n' "$commit_msg" | grep -qE "$pattern" || invalid_message
  [ ${#commit_msg} -le 120 ] || message_too_long
}

main "$@"
