#!/bin/sh
set -eu

concurrency_timeout() {
  printf 'Package-manager resolution did not run concurrently\n' >&2
  exit 70
}

partner_pending() {
  [ ! -f "$BINARY_CONCURRENCY_DIR/$other" ]
}

wait_for_partner() {
  attempt=0
  while partner_pending; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 20 ] || concurrency_timeout
    sleep 0.05
  done
}

main() {
  package="${2:?package name is required}"
  other="alpha"
  [ "$package" != "alpha" ] || other="beta"
  touch "$BINARY_CONCURRENCY_DIR/$package"
  wait_for_partner
  printf '2.0.0\n'
}

main "$@"
