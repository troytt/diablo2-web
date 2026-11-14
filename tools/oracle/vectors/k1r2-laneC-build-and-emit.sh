#!/usr/bin/env bash
# Compiles k1r2-laneC-emitter.c and k1r2-laneC-it3-emitter.c with i686 MinGW and runs them under
# the bundled 1.13c Wine environment to emit real-DLL differential fixtures for Lane C batches.
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/tests/fixtures/oracle/k1/laneC}"
mkdir -p "$OUT_DIR"

ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-/tmp/d2w-k1r2-laneC-build}"
mkdir -p "$BUILD_DIR"

CFLAGS="-O2 -Wall -Wextra -Wno-cast-function-type -static-libgcc"
"$CC" $CFLAGS "$VEC_DIR/k1r2-laneC-emitter.c" -o "$BUILD_DIR/k1r2-laneC-emitter.exe"
"$CC" $CFLAGS -fno-omit-frame-pointer "$VEC_DIR/k1r2-laneC-it3-emitter.c" -o "$BUILD_DIR/k1r2-laneC-it3-emitter.exe"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2tv-laneC-pfx.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k1r2-laneC-emitter.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k1r2-laneC-it3-emitter.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out"

(
  cd "$PFX/drive_c/D2"
  "$W/wine" k1r2-laneC-emitter.exe \
    "C:\\out\\b001-vectors.ndjson" \
    "C:\\out\\b007-vectors.ndjson" \
    "C:\\out\\b004-vectors.ndjson" \
    "C:\\out\\b016-vectors.ndjson"
  "$W/wine" k1r2-laneC-it3-emitter.exe \
    "C:\\out\\b010-vectors.ndjson" \
    "C:\\out\\b013-vectors.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
)

cp "$PFX/drive_c/out/b001-vectors.ndjson" "$OUT_DIR/b001-vectors.ndjson"
cp "$PFX/drive_c/out/b007-vectors.ndjson" "$OUT_DIR/b007-vectors.ndjson"
cp "$PFX/drive_c/out/b004-vectors.ndjson" "$OUT_DIR/b004-vectors.ndjson"
cp "$PFX/drive_c/out/b016-vectors.ndjson" "$OUT_DIR/b016-vectors.ndjson"
cp "$PFX/drive_c/out/b010-vectors.ndjson" "$OUT_DIR/b010-vectors.ndjson"
cp "$PFX/drive_c/out/b013-vectors.ndjson" "$OUT_DIR/b013-vectors.ndjson"
sha256sum \
  "$OUT_DIR/b001-vectors.ndjson" \
  "$OUT_DIR/b007-vectors.ndjson" \
  "$OUT_DIR/b004-vectors.ndjson" \
  "$OUT_DIR/b016-vectors.ndjson" \
  "$OUT_DIR/b010-vectors.ndjson" \
  "$OUT_DIR/b013-vectors.ndjson"
