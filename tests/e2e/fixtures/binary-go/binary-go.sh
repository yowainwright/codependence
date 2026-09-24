#!/bin/sh
set -eu

unexpected_arguments() {
  printf 'Unexpected go arguments: %s\n' "$*" >&2
  exit 64
}

main() {
  case "$*" in
  "list -m -versions example.com/dependency") printf 'example.com/dependency v1.0.0 v1.1.0\n' ;;
  "mod tidy") printf 'tidied\n' >"$GO_TIDY_LOG" ;;
  *) unexpected_arguments "$@" ;;
  esac
}

main "$@"
