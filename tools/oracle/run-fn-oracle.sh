#!/usr/bin/env bash
# Run the function-level oracle (hook/fnharness.dll.c) on a request file.
#
# Usage: tools/oracle/run-fn-oracle.sh <fn-req.ndjson> <out_dir> [seconds]
#   ORACLE_PREFIX  WINEPREFIX to use (default $D2_ORACLE_ROOT/wine/prefix-fn;
#                  create it once with cp -a .../wine/prefix .../wine/prefix-fn
#                  so concurrent oracle runs do not share a wineserver)
#   ORACLE_SAVE    character (default tests/fixtures/oracle/saves/a1-barbarian-l1.d2s)
# The responses land in <out_dir>/fn-resp.ndjson (one line per request line).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
ROOT=${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}
REQ=$(realpath "${1:?fn-req.ndjson}")
OUT=$(realpath -m "${2:?out dir}")
SECS=${3:-600}
export ORACLE_PREFIX=${ORACLE_PREFIX:-$ROOT/wine/prefix-fn}
if [ ! -d "$ORACLE_PREFIX" ]; then
  if [ -d "$ROOT/wine/prefix" ]; then
    cp -a "$ROOT/wine/prefix" "$ORACLE_PREFIX"
  else
    echo "missing $ORACLE_PREFIX (cp -a $ROOT/wine/prefix $ORACLE_PREFIX)" >&2
    exit 2
  fi
fi
export ORACLE_DLL=fnharness.dll
export ORACLE_SAVE=${ORACLE_SAVE:-$REPO/tests/fixtures/oracle/saves/a1-barbarian-l1.d2s}
mkdir -p "$ORACLE_PREFIX/drive_c/oracle" "$OUT"
rm -f "$ORACLE_PREFIX/drive_c/oracle/daemon.mode"
cp "$REQ" "$ORACLE_PREFIX/drive_c/oracle/fn-req.ndjson"
"$HERE/run-oracle.sh" "$HERE/menus/sp-first-char.txt" "$OUT" "$SECS" -w -ns
if [ ! -f "$OUT/done" ] || [ ! -f "$OUT/fn-resp.ndjson" ]; then
  echo "fn oracle did not finish (see $OUT/log.txt)" >&2
  exit 1
fi
echo "fn oracle: $OUT/fn-resp.ndjson ($(wc -l <"$OUT/fn-resp.ndjson") lines)"
