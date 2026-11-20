#!/usr/bin/env bash
# Build and run tools/oracle/vectors/monspawn-emitter.c under Wine to produce or
# verify the [K2] MONSPAWN D2TV binary fixture:
#   - tests/fixtures/oracle/k2/monspawn-113c.d2tv.gz
#
# Usage:
#   bash tools/oracle/vectors/run-monspawn-emitter.sh           # generate fixture
#   bash tools/oracle/vectors/run-monspawn-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k2"
OUT_FILE="$OUT_DIR/monspawn-113c.d2tv.gz"

ORACLE_ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="$ORACLE_ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32"
WINE_DIR="$ORACLE_ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

CACHE_DIR="${D2_VECTOR_CACHE_DIR:-$HOME/.cache/k2-eg-vectors}"
PFX="$CACHE_DIR/pfx-monspawn"
mkdir -p "$CACHE_DIR" "$OUT_DIR"

if [ ! -d "$PFX/drive_c/D2" ]; then
  rm -rf "$PFX"
  mkdir -p "$PFX"
  cp -a "$ORACLE_ROOT/wine/prefix/." "$PFX/"
fi

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc -I"$SCRIPT_DIR")

echo "[run-monspawn-emitter] Compiling monspawn-emitter.c (-O2 and -O2 -fno-omit-frame-pointer)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 "$SCRIPT_DIR/monspawn-emitter.c" -o "$PFX/drive_c/D2/monspawn-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer "$SCRIPT_DIR/monspawn-emitter.c" -o "$PFX/drive_c/D2/monspawn-emitter-fp.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

run_wine() {
  (cd "$PFX/drive_c/D2" && timeout 300 "$WINE_DIR/wine" "$@")
}

echo "[run-monspawn-emitter] Running monspawn-emitter (-O2)..."
run_wine monspawn-emitter-o2.exe "C:\\D2\\monspawn-o2.d2tv"

echo "[run-monspawn-emitter] Running monspawn-emitter (-O2 -fno-omit-frame-pointer)..."
run_wine monspawn-emitter-fp.exe "C:\\D2\\monspawn-fp.d2tv"

SHA_O2="$(sha256sum "$PFX/drive_c/D2/monspawn-o2.d2tv" | awk '{print $1}')"
SHA_FP="$(sha256sum "$PFX/drive_c/D2/monspawn-fp.d2tv" | awk '{print $1}')"
rm -f "$PFX/drive_c/D2/monspawn-fp.d2tv"

echo "  MONSPAWN -O2: $SHA_O2"
echo "  MONSPAWN -fp: $SHA_FP"

if [ "$SHA_O2" != "$SHA_FP" ]; then
  echo "[run-monspawn-emitter] ERROR: -O2 and -O2 -fno-omit-frame-pointer outputs differ!" >&2
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  SHA_OLD="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  rm -f "$PFX/drive_c/D2/monspawn-o2.d2tv"
  echo "  monspawn-113c: $SHA_O2 (expected $SHA_OLD)"
  if [ "$SHA_O2" != "$SHA_OLD" ]; then
    echo "[run-monspawn-emitter] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[run-monspawn-emitter] --check PASSED (100% byte-identical)."
  exit 0
fi

gzip -n -9 -c "$PFX/drive_c/D2/monspawn-o2.d2tv" > "$OUT_FILE"
rm -f "$PFX/drive_c/D2/monspawn-o2.d2tv"
ls -lh "$OUT_FILE"
