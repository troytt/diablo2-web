#!/usr/bin/env bash
# Build and run tools/oracle/vectors/path-emitter.c under Wine to produce or
# verify the [K1-6] PATH D2TV binary fixtures:
#   - tests/fixtures/oracle/vectors/path-vectors-113c.d2tv.gz
#   - tests/fixtures/oracle/vectors/path-world-town-s12345.img.gz
#
# Usage:
#   bash tools/oracle/vectors/run-path-emitter.sh           # generate fixtures
#   bash tools/oracle/vectors/run-path-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/vectors"

ORACLE_ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="$ORACLE_ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32"
WINE_DIR="$ORACLE_ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

CACHE_DIR="${D2_VECTOR_CACHE_DIR:-$HOME/.cache/k1r4-eg-vectors}"
PFX="$CACHE_DIR/pfx-path"
mkdir -p "$CACHE_DIR" "$OUT_DIR"

if [ ! -d "$PFX/drive_c/D2" ]; then
  rm -rf "$PFX"
  mkdir -p "$PFX"
  cp -a "$ORACLE_ROOT/wine/prefix/." "$PFX/"
fi

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc -I"$SCRIPT_DIR")

echo "[run-path-emitter] Compiling path-emitter.c (-O2 and -O2 -fno-omit-frame-pointer)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 "$SCRIPT_DIR/path-emitter.c" -o "$PFX/drive_c/D2/path-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer "$SCRIPT_DIR/path-emitter.c" -o "$PFX/drive_c/D2/path-emitter-fp.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

run_wine() {
  (cd "$PFX/drive_c/D2" && timeout 300 "$WINE_DIR/wine" "$@")
}

echo "[run-path-emitter] Running path-emitter (-O2)..."
run_wine path-emitter-o2.exe "C:\\D2\\path-vec-o2.d2tv" "C:\\D2\\path-img-o2.img"

echo "[run-path-emitter] Running path-emitter (-O2 -fno-omit-frame-pointer) to verify compiler-flag parity..."
run_wine path-emitter-fp.exe "C:\\D2\\path-vec-fp.d2tv" "C:\\D2\\path-img-fp.img"

SHA_VEC_O2="$(sha256sum "$PFX/drive_c/D2/path-vec-o2.d2tv" | awk '{print $1}')"
SHA_VEC_FP="$(sha256sum "$PFX/drive_c/D2/path-vec-fp.d2tv" | awk '{print $1}')"
SHA_IMG_O2="$(sha256sum "$PFX/drive_c/D2/path-img-o2.img" | awk '{print $1}')"
SHA_IMG_FP="$(sha256sum "$PFX/drive_c/D2/path-img-fp.img" | awk '{print $1}')"
rm -f "$PFX/drive_c/D2/path-vec-fp.d2tv" "$PFX/drive_c/D2/path-img-fp.img"

echo "  PATHVEC -O2: $SHA_VEC_O2"
echo "  PATHVEC -fp: $SHA_VEC_FP"
echo "  PAGEIMG -O2: $SHA_IMG_O2"
echo "  PAGEIMG -fp: $SHA_IMG_FP"

if [ "$SHA_VEC_O2" != "$SHA_VEC_FP" ] || [ "$SHA_IMG_O2" != "$SHA_IMG_FP" ]; then
  echo "[run-path-emitter] ERROR: -O2 and -O2 -fno-omit-frame-pointer outputs differ!" >&2
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  SHA_VEC_OLD="$(gzip -dc "$OUT_DIR/path-vectors-113c.d2tv.gz" | sha256sum | awk '{print $1}')"
  SHA_IMG_OLD="$(gzip -dc "$OUT_DIR/path-world-town-s12345.img.gz" | sha256sum | awk '{print $1}')"
  rm -f "$PFX/drive_c/D2/path-vec-o2.d2tv" "$PFX/drive_c/D2/path-img-o2.img"
  echo "  path-vectors-113c:        $SHA_VEC_O2 (expected $SHA_VEC_OLD)"
  echo "  path-world-town-s12345:   $SHA_IMG_O2 (expected $SHA_IMG_OLD)"
  if [ "$SHA_VEC_O2" != "$SHA_VEC_OLD" ] || [ "$SHA_IMG_O2" != "$SHA_IMG_OLD" ]; then
    echo "[run-path-emitter] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[run-path-emitter] --check PASSED (100% byte-identical)."
  exit 0
fi

echo "[run-path-emitter] Compressing fixtures with gzip -n -9..."
gzip -n -9 -c "$PFX/drive_c/D2/path-vec-o2.d2tv" > "$OUT_DIR/path-vectors-113c.d2tv.gz"
gzip -n -9 -c "$PFX/drive_c/D2/path-img-o2.img" > "$OUT_DIR/path-world-town-s12345.img.gz"
rm -f "$PFX/drive_c/D2/path-vec-o2.d2tv" "$PFX/drive_c/D2/path-img-o2.img"

ls -lh "$OUT_DIR"/path-*.gz
