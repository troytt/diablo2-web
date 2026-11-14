#!/usr/bin/env bash
# Build and run tools/oracle/vectors/drlg-emitter.c under Wine to produce or
# verify the [K1-5] DRLG D2TV binary fixtures:
#   - tests/fixtures/oracle/vectors/drlg-digest-113c.d2tv.gz
#   - tests/fixtures/oracle/vectors/drlg-rooms-s12345.d2tv.gz
#   - tests/fixtures/oracle/vectors/drlg-coll-towns-s12345-d0.d2tv.gz
#
# Usage:
#   bash tools/oracle/vectors/run-drlg-emitter.sh           # generate fixtures
#   bash tools/oracle/vectors/run-drlg-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/vectors"

ORACLE_ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="$ORACLE_ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32"
WINE_DIR="$ORACLE_ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

CACHE_DIR="${D2_VECTOR_CACHE_DIR:-$HOME/.cache/k1r4-eg-vectors}"
PFX="$CACHE_DIR/pfx-drlg"
mkdir -p "$CACHE_DIR" "$OUT_DIR"

if [ ! -d "$PFX/drive_c/D2" ]; then
  rm -rf "$PFX"
  mkdir -p "$PFX"
  cp -a "$ORACLE_ROOT/wine/prefix/." "$PFX/"
fi

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc -I"$SCRIPT_DIR")

echo "[run-drlg-emitter] Compiling drlg-emitter.c (-O2 and -O2 -fno-omit-frame-pointer)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 "$SCRIPT_DIR/drlg-emitter.c" -o "$PFX/drive_c/D2/drlg-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer "$SCRIPT_DIR/drlg-emitter.c" -o "$PFX/drive_c/D2/drlg-emitter-fp.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

run_wine() {
  (cd "$PFX/drive_c/D2" && timeout 600 "$WINE_DIR/wine" "$@")
}

echo "[run-drlg-emitter] Verifying forward/reverse seed order and ENV stability (-O2 vs -fno-omit-frame-pointer)..."
OUT_O2="$(run_wine drlg-emitter-o2.exe --verify-order | tr -d '\r')"
OUT_FP="$(run_wine drlg-emitter-fp.exe --verify-order | tr -d '\r')"
echo "  -O2: $OUT_O2"
echo "  -fp: $OUT_FP"
if [ "$OUT_O2" != "$OUT_FP" ]; then
  echo "[run-drlg-emitter] ERROR: -O2 and -O2 -fno-omit-frame-pointer outputs differ!" >&2
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  echo "[run-drlg-emitter] Running full --check regeneration..."
  run_wine drlg-emitter-o2.exe "C:\\D2\\chk-dig.d2tv" "C:\\D2\\chk-rooms.d2tv" "C:\\D2\\chk-coll.d2tv"
  SHA_DIG_NEW="$(sha256sum "$PFX/drive_c/D2/chk-dig.d2tv" | awk '{print $1}')"
  SHA_ROOMS_NEW="$(sha256sum "$PFX/drive_c/D2/chk-rooms.d2tv" | awk '{print $1}')"
  SHA_COLL_NEW="$(sha256sum "$PFX/drive_c/D2/chk-coll.d2tv" | awk '{print $1}')"
  SHA_DIG_OLD="$(gzip -dc "$OUT_DIR/drlg-digest-113c.d2tv.gz" | sha256sum | awk '{print $1}')"
  SHA_ROOMS_OLD="$(gzip -dc "$OUT_DIR/drlg-rooms-s12345.d2tv.gz" | sha256sum | awk '{print $1}')"
  SHA_COLL_OLD="$(gzip -dc "$OUT_DIR/drlg-coll-towns-s12345-d0.d2tv.gz" | sha256sum | awk '{print $1}')"
  rm -f "$PFX/drive_c/D2/chk-dig.d2tv" "$PFX/drive_c/D2/chk-rooms.d2tv" "$PFX/drive_c/D2/chk-coll.d2tv"
  echo "  drlg-digest-113c:           $SHA_DIG_NEW (expected $SHA_DIG_OLD)"
  echo "  drlg-rooms-s12345:          $SHA_ROOMS_NEW (expected $SHA_ROOMS_OLD)"
  echo "  drlg-coll-towns-s12345-d0:  $SHA_COLL_NEW (expected $SHA_COLL_OLD)"
  if [ "$SHA_DIG_NEW" != "$SHA_DIG_OLD" ] || [ "$SHA_ROOMS_NEW" != "$SHA_ROOMS_OLD" ] || [ "$SHA_COLL_NEW" != "$SHA_COLL_OLD" ]; then
    echo "[run-drlg-emitter] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[run-drlg-emitter] --check PASSED (100% byte-identical)."
  exit 0
fi

echo "[run-drlg-emitter] Emitting full DRLG D2TV fixtures (50 seeds x 3 diffs x 136 levels)..."
run_wine drlg-emitter-o2.exe "C:\\D2\\drlg-digest-113c.d2tv" "C:\\D2\\drlg-rooms-s12345.d2tv" "C:\\D2\\drlg-coll-towns-s12345-d0.d2tv"

echo "[run-drlg-emitter] Compressing fixtures with gzip -n -9..."
gzip -n -9 -c "$PFX/drive_c/D2/drlg-digest-113c.d2tv" > "$OUT_DIR/drlg-digest-113c.d2tv.gz"
gzip -n -9 -c "$PFX/drive_c/D2/drlg-rooms-s12345.d2tv" > "$OUT_DIR/drlg-rooms-s12345.d2tv.gz"
gzip -n -9 -c "$PFX/drive_c/D2/drlg-coll-towns-s12345-d0.d2tv" > "$OUT_DIR/drlg-coll-towns-s12345-d0.d2tv.gz"

echo "[run-drlg-emitter] Raw SHA-256 digests:"
sha256sum "$PFX/drive_c/D2/drlg-digest-113c.d2tv" "$PFX/drive_c/D2/drlg-rooms-s12345.d2tv" "$PFX/drive_c/D2/drlg-coll-towns-s12345-d0.d2tv"
rm -f "$PFX/drive_c/D2/drlg-digest-113c.d2tv" "$PFX/drive_c/D2/drlg-rooms-s12345.d2tv" "$PFX/drive_c/D2/drlg-coll-towns-s12345-d0.d2tv"
ls -lh "$OUT_DIR"/drlg-*.d2tv.gz
