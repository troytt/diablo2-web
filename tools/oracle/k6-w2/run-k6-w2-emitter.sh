#!/usr/bin/env bash
# Build and run tools/oracle/k6-w2/k6-w2-d2game-emitter.c under headless Wine
# to produce or verify the [K6] Wave 2 real-DLL D2Game.dll (0x6FC80000..0x6FD15000)
# differential vector fixture:
#   - tests/fixtures/oracle/k6-w2/k6-w2-d2game-vectors.ndjson.gz
#
# Usage:
#   bash tools/oracle/k6-w2/run-k6-w2-emitter.sh           # generate fixture
#   bash tools/oracle/k6-w2/run-k6-w2-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k6-w2"
OUT_FILE="$OUT_DIR/k6-w2-d2game-vectors.ndjson.gz"
DATATBLS_GZ="$REPO_ROOT/tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz"

ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
WINE_DIR="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

RUN_BASE="${D2_ORACLE_RUN_BASE:-$HOME/.cache/d2oracle-runs}"
mkdir -p "$OUT_DIR" "$RUN_BASE"

PFX="$(mktemp -d "$RUN_BASE/k6-w2-wine.XXXXXX")"
cleanup() {
  WINESERVER="$WINE_DIR/wineserver" WINEPREFIX="$PFX" "$WINE_DIR/wineserver" -k 2>/dev/null || true
  rm -rf "$PFX"
}
trap cleanup EXIT

cp -a "$ROOT/wine/prefix/." "$PFX/"
mkdir -p "$PFX/drive_c/D2"

D2_DATA_DIR="${D2_DATA_DIR:-$HOME/d2-data}"
for dll in Storm.dll Fog.dll D2Lang.dll D2CMP.dll D2Common.dll D2Net.dll D2Game.dll; do
  if [ ! -f "$PFX/drive_c/D2/$dll" ] && [ -f "$D2_DATA_DIR/$dll" ]; then
    cp "$D2_DATA_DIR/$dll" "$PFX/drive_c/D2/$dll"
  fi
done

gzip -dc "$DATATBLS_GZ" > "$PFX/drive_c/D2/d2game-datatbls-113c.img"

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -static-libgcc)

echo "[k6-w2] Compiling k6-w2-d2game-emitter.c (-O2 and -O2 -fno-omit-frame-pointer)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 \
  "$SCRIPT_DIR/k6-w2-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w2-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer \
  "$SCRIPT_DIR/k6-w2-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w2-emitter-fp.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

echo "[k6-w2] Running k6-w2-emitter-o2.exe under headless Wine..."
(
  cd "$PFX/drive_c/D2"
  timeout 120s "$WINE_DIR/wine" k6-w2-emitter-o2.exe \
    "C:\\D2\\d2game-datatbls-113c.img" \
    "C:\\D2\\vectors-o2.ndjson"
  "$WINE_DIR/wineserver" -k 2>/dev/null || true
)

echo "[k6-w2] Running k6-w2-emitter-fp.exe under headless Wine..."
(
  cd "$PFX/drive_c/D2"
  timeout 120s "$WINE_DIR/wine" k6-w2-emitter-fp.exe \
    "C:\\D2\\d2game-datatbls-113c.img" \
    "C:\\D2\\vectors-fp.ndjson"
  "$WINE_DIR/wineserver" -k 2>/dev/null || true
)

SHA_O2="$(sha256sum "$PFX/drive_c/D2/vectors-o2.ndjson" | awk '{print $1}')"
SHA_FP="$(sha256sum "$PFX/drive_c/D2/vectors-fp.ndjson" | awk '{print $1}')"

echo "  k6-w2 -O2: $SHA_O2"
echo "  k6-w2 -fp: $SHA_FP"

if [ "$SHA_O2" != "$SHA_FP" ]; then
  echo "[k6-w2] ERROR: -O2 and -O2 -fno-omit-frame-pointer outputs differ!" >&2
  exit 1
fi

LINE_COUNT="$(wc -l < "$PFX/drive_c/D2/vectors-o2.ndjson" | tr -d ' ')"
echo "  k6-w2 emitted vector lines: $LINE_COUNT"

if [ "${1:-}" = "--check" ]; then
  SHA_OLD="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  echo "  expected:  $SHA_OLD"
  if [ "$SHA_O2" != "$SHA_OLD" ]; then
    echo "[k6-w2] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[k6-w2] --check PASSED (100% SHA-256 identical)."
  exit 0
fi

gzip -n -9 -c "$PFX/drive_c/D2/vectors-o2.ndjson" > "$OUT_FILE"
ls -lh "$OUT_FILE"
