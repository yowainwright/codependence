#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

sh "$SCRIPT_DIR/rust.sh"
sh "$SCRIPT_DIR/docker.sh"
sh "$SCRIPT_DIR/github-actions.sh"
sh "$SCRIPT_DIR/mixed.sh"
sh "$SCRIPT_DIR/uv.sh"
