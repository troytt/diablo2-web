#!/usr/bin/env bash
# Build and run tools/oracle/vectors/s2c-emitter.c under Wine to produce or
# verify the [K4] S2C D2TV binary fixture:
#   - tests/fixtures/oracle/k4/s2c-113c.d2tv.gz
#
# Usage:
#   bash tools/oracle/vectors/run-s2c-emitter.sh           # generate fixture
#   bash tools/oracle/vectors/run-s2c-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k4"
OUT_FILE="$OUT_DIR/s2c-113c.d2tv.gz"

ORACLE_ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
D2_DATA="${D2_DATA_DIR:-$HOME/d2-data}"
CC="$ORACLE_ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32"
if [ ! -x "$CC" ]; then
  CC="$(command -v i686-w64-mingw32-gcc)"
fi
WINE_DIR="$ORACLE_ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

CACHE_DIR="${D2_VECTOR_CACHE_DIR:-$HOME/.cache/k4-eg-vectors}"
PFX="$CACHE_DIR/pfx-s2c"
mkdir -p "$CACHE_DIR" "$OUT_DIR"

if [ ! -d "$PFX/drive_c/D2" ]; then
  rm -rf "$PFX"
  mkdir -p "$PFX"
  cp -a "$ORACLE_ROOT/wine/prefix/." "$PFX/"
fi

# Overlay or backfill any missing 1.13c DLLs / MPQs from portable $D2_DATA_DIR / $HOME/d2-data
if [ -d "$D2_DATA" ]; then
  for asset in Storm.dll Fog.dll D2Lang.dll D2Common.dll D2Net.dll D2Game.dll d2data.mpq d2exp.mpq Patch_D2.mpq d2char.mpq; do
    if [ ! -f "$PFX/drive_c/D2/$asset" ] && [ -f "$D2_DATA/$asset" ]; then
      cp -f "$D2_DATA/$asset" "$PFX/drive_c/D2/$asset"
    fi
  done
fi

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc -I"$SCRIPT_DIR")

echo "[run-s2c-emitter] Compiling s2c-emitter.c (-O2 and -O2 -fno-omit-frame-pointer)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 "$SCRIPT_DIR/s2c-emitter.c" -o "$PFX/drive_c/D2/s2c-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer "$SCRIPT_DIR/s2c-emitter.c" -o "$PFX/drive_c/D2/s2c-emitter-fp.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

run_wine() {
  (cd "$PFX/drive_c/D2" && timeout 300 "$WINE_DIR/wine" "$@")
}

echo "[run-s2c-emitter] Running s2c-emitter (-O2)..."
run_wine s2c-emitter-o2.exe "C:\\D2\\s2c-o2.d2tv"

echo "[run-s2c-emitter] Running s2c-emitter (-O2 -fno-omit-frame-pointer)..."
run_wine s2c-emitter-fp.exe "C:\\D2\\s2c-fp.d2tv"

SHA_O2="$(sha256sum "$PFX/drive_c/D2/s2c-o2.d2tv" | awk '{print $1}')"
SHA_FP="$(sha256sum "$PFX/drive_c/D2/s2c-fp.d2tv" | awk '{print $1}')"
rm -f "$PFX/drive_c/D2/s2c-fp.d2tv" "$PFX/drive_c/D2/s2c-emitter-o2.exe" "$PFX/drive_c/D2/s2c-emitter-fp.exe"

echo "  S2C -O2: $SHA_O2"
echo "  S2C -fp: $SHA_FP"

if [ "$SHA_O2" != "$SHA_FP" ]; then
  echo "[run-s2c-emitter] ERROR: -O2 and -O2 -fno-omit-frame-pointer outputs differ!" >&2
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  SHA_OLD="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  rm -f "$PFX/drive_c/D2/s2c-o2.d2tv"
  echo "  s2c-113c: $SHA_O2 (expected $SHA_OLD)"
  if [ "$SHA_O2" != "$SHA_OLD" ]; then
    echo "[run-s2c-emitter] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[run-s2c-emitter] --check PASSED (100% byte-identical)."
  exit 0
fi

gzip -n -9 -c "$PFX/drive_c/D2/s2c-o2.d2tv" > "$OUT_FILE"
rm -f "$PFX/drive_c/D2/s2c-o2.d2tv"
ls -lh "$OUT_FILE"
