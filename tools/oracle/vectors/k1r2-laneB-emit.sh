#!/usr/bin/env bash
# Compiles k1r2-laneB-emitter.c with i686-w64-mingw32-gcc and runs it against
# the real Diablo II v1.13c D2Common.dll / Fog.dll / Storm.dll under Wine to emit
# deterministic B003 + B006 differential fixtures.
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/tests/fixtures/oracle/k1}"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-$ROOT/build}"
mkdir -p "$BUILD_DIR" "$OUT_DIR"

CFLAGS="-O2 -Wall -Wextra -Wno-cast-function-type -static-libgcc"
"$CC" $CFLAGS -I"$VEC_DIR" "$VEC_DIR/k1r2-laneB-emitter.c" -o "$BUILD_DIR/k1r2-laneB-emitter.exe"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2tv-laneB.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k1r2-laneB-emitter.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out"

(
  cd "$PFX/drive_c/D2"
  "$W/wine" k1r2-laneB-emitter.exe "C:\\out"
  "$W/wineserver" -k 2>/dev/null || true
)

cp "$PFX/drive_c/out/b003-vectors.json" "$OUT_DIR/b003-vectors.json"
cp "$PFX/drive_c/out/b006-vectors.json" "$OUT_DIR/b006-vectors.json"
cp "$PFX/drive_c/out/b009-vectors.json" "$OUT_DIR/b009-vectors.json"
cp "$PFX/drive_c/out/b012-vectors.json" "$OUT_DIR/b012-vectors.json"
sha256sum "$OUT_DIR/b003-vectors.json" "$OUT_DIR/b006-vectors.json" "$OUT_DIR/b009-vectors.json" "$OUT_DIR/b012-vectors.json"
