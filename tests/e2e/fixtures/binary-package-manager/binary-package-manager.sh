#!/bin/sh
set -eu

unexpected_arguments() {
  printf 'Unexpected npm arguments: %s\n' "$*" >&2
  exit 64
}

main() {
  [ "$*" = "view lodash version latest" ] || unexpected_arguments "$@"
  printf '4.17.21\n'
}

main "$@"
