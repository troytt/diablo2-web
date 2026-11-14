#!/usr/bin/env bash
# Compiles k1r3-laneB-it9-emitter.c with i686-w64-mingw32-gcc and runs it against the real
# Diablo II v1.13c D2Common.dll / Fog.dll / Storm.dll under Wine to emit the Iteration 9 Lane B
# differential fixtures (I9B-B; I9B-A when present).
# Usage: k1r3-laneB-it9-emit.sh [OUT_DIR] [EXTRA_CFLAGS...]
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/tests/fixtures/oracle/k1}"
shift || true
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-$ROOT/build}"
mkdir -p "$BUILD_DIR" "$OUT_DIR"

CFLAGS="-m32 -O2 -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc $*"
# shellcheck disable=SC2086
"$CC" $CFLAGS "$VEC_DIR/k1r3-laneB-it9-emitter.c" -o "$BUILD_DIR/k1r3-laneB-it9-emitter.exe"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2tv-laneB-it9.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"
# Always run against the real 1.13c DLLs from D2_DATA_DIR (default ~/d2-data).
D2_DATA_DIR="${D2_DATA_DIR:-$HOME/d2-data}"
cp "$D2_DATA_DIR/D2Common.dll" "$D2_DATA_DIR/Fog.dll" "$D2_DATA_DIR/Storm.dll" "$PFX/drive_c/D2/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k1r3-laneB-it9-emitter.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out"
(
  cd "$PFX/drive_c/D2"
  "$W/wine" k1r3-laneB-it9-emitter.exe "C:\\D2" "C:\\out\\i9b-b-vectors.ndjson" "C:\\out\\i9b-a-vectors.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
)
for f in i9b-b-vectors.ndjson i9b-a-vectors.ndjson; do
  if [ -f "$PFX/drive_c/out/$f" ]; then
    cp "$PFX/drive_c/out/$f" "$OUT_DIR/$f"
    sha256sum "$OUT_DIR/$f"
  fi
done
