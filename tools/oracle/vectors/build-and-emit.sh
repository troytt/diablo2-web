#!/usr/bin/env bash
# Compiles PRNG & EVTWHEEL MinGW emitters and collects ground-truth .d2tv binary
# test vectors directly from Diablo II v1.13c D2Common.dll & D2Game.dll under Wine.
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-$ROOT/build}"
mkdir -p "$BUILD_DIR"

CFLAGS="-O2 -Wall -Wextra -Wno-cast-function-type -static-libgcc"

"$CC" $CFLAGS -I"$VEC_DIR" "$VEC_DIR/prng-emitter.c" -o "$BUILD_DIR/prng-emitter.exe"
"$CC" $CFLAGS -I"$VEC_DIR" "$VEC_DIR/eventwheel-emitter.c" -o "$BUILD_DIR/eventwheel-emitter.exe"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2tv-pfx.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/prng-emitter.exe" "$BUILD_DIR/eventwheel-emitter.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out"

(
  cd "$PFX/drive_c/D2"
  "$W/wine" prng-emitter.exe "C:\\out\\prng-10k.d2tv" 10000
  "$W/wine" eventwheel-emitter.exe "C:\\out\\eventwheel-113c.d2tv" 256
  "$W/wineserver" -k 2>/dev/null || true
)

cp "$PFX/drive_c/out/prng-10k.d2tv" "$VEC_DIR/prng-10k.d2tv"
cp "$PFX/drive_c/out/eventwheel-113c.d2tv" "$VEC_DIR/eventwheel-113c.d2tv"
echo "Generated $VEC_DIR/prng-10k.d2tv and $VEC_DIR/eventwheel-113c.d2tv"
