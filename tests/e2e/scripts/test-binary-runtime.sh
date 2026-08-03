#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/../provider/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
mkdir -p "$WORK_DIR/bin"

cat > "$WORK_DIR/bin/npm" <<'SH'
#!/bin/sh
if [ "$*" = "view lodash version latest" ]; then
  printf '4.17.21\n'
  exit 0
fi

printf 'Unexpected npm arguments: %s\n' "$*" >&2
exit 64
SH
chmod +x "$WORK_DIR/bin/npm"

cat > "$WORK_DIR/package.json" <<'JSON'
{
  "name": "binary-child-process-test",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "4.17.20"
  }
}
JSON

cat > "$WORK_DIR/.codependencerc" <<'JSON'
{
  "mode": "verbose",
  "codependencies": ["lodash"]
}
JSON

PATH="$WORK_DIR/bin:$PATH"
export PATH
run_update "$WORK_DIR"
assert_file_contains "$WORK_DIR/package.json" '"lodash": "4.17.21"' "binary package-manager subprocess"

make_tmp_dir
mkdir -p "$WORK_DIR/bin" "$WORK_DIR/running"
cat > "$WORK_DIR/bin/npm" <<'SH'
#!/bin/sh
package="$2"
other="alpha"
if [ "$package" = "alpha" ]; then
  other="beta"
fi

touch "$BINARY_CONCURRENCY_DIR/$package"
attempt=0
while [ ! -f "$BINARY_CONCURRENCY_DIR/$other" ]; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    printf 'Package-manager resolution did not run concurrently\n' >&2
    exit 70
  fi
  sleep 0.05
done

printf '2.0.0\n'
SH
chmod +x "$WORK_DIR/bin/npm"

cat > "$WORK_DIR/package.json" <<'JSON'
{
  "name": "binary-concurrency-test",
  "version": "1.0.0",
  "dependencies": {
    "alpha": "1.0.0",
    "beta": "1.0.0"
  }
}
JSON

cat > "$WORK_DIR/.codependencerc" <<'JSON'
{
  "mode": "verbose",
  "codependencies": ["alpha", "beta"]
}
JSON

PATH="$WORK_DIR/bin:$PATH"
BINARY_CONCURRENCY_DIR="$WORK_DIR/running"
export PATH BINARY_CONCURRENCY_DIR
run_update "$WORK_DIR"
assert_file_contains "$WORK_DIR/package.json" '"alpha": "2.0.0"' "binary concurrent subprocesses"
assert_file_contains "$WORK_DIR/package.json" '"beta": "2.0.0"' "binary concurrent subprocess output"

make_tmp_dir
mkdir -p "$WORK_DIR/bin"
cat > "$WORK_DIR/bin/go" <<'SH'
#!/bin/sh
if [ "$*" = "list -m -versions example.com/dependency" ]; then
  printf 'example.com/dependency v1.0.0 v1.1.0\n'
  exit 0
fi

if [ "$*" = "mod tidy" ]; then
  printf 'tidied\n' > "$GO_TIDY_LOG"
  exit 0
fi

printf 'Unexpected go arguments: %s\n' "$*" >&2
exit 64
SH
chmod +x "$WORK_DIR/bin/go"

cat > "$WORK_DIR/go.mod" <<'MOD'
module example.com/binary-test

go 1.22

require example.com/dependency v1.0.0
MOD

cat > "$WORK_DIR/.codependencerc" <<'JSON'
{
  "mode": "verbose",
  "codependencies": ["example.com/dependency"]
}
JSON

PATH="$WORK_DIR/bin:$PATH"
GO_TIDY_LOG="$WORK_DIR/go-tidy.log"
export PATH GO_TIDY_LOG
run_update "$WORK_DIR"
assert_file_contains "$WORK_DIR/go.mod" 'example.com/dependency v1.1.0' "binary Go resolver subprocess"
assert_file_contains "$WORK_DIR/go-tidy.log" 'tidied' "binary synchronous Go subprocess"

make_tmp_dir
cat > "$WORK_DIR/package.json" <<'JSON'
{
  "name": "binary-interactive-test",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "4.17.21"
  }
}
JSON

python3 "$SCRIPT_DIR/test-binary-interactive.py" "$BINARY_CLI" "$WORK_DIR"
assert_file_contains "$WORK_DIR/.codependencerc" '"lodash"' "binary streaming TTY prompts"
