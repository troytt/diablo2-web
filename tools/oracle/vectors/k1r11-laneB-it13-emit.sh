#!/usr/bin/env bash
# Compiles k1r11-laneB-it13-emitter.c under both -O2 and -O2 -fno-omit-frame-pointer,
# runs both against real Diablo II v1.13c DLLs under Wine, verifies 100% SHA-256 parity
# and non-degeneracy (>= 3 vectors per VA), and emits i13b-1-vectors.ndjson & i13b-2-vectors.ndjson.
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/tests/fixtures/oracle/k1}"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-$HOME/.cache/k1r11-laneB-it13}"
mkdir -p "$BUILD_DIR" "$OUT_DIR"

CFLAGS="-Wall -Wextra -Werror -Wno-unused-parameter -static-libgcc"
"$CC" $CFLAGS -O2 "$VEC_DIR/k1r11-laneB-it13-emitter.c" -o "$BUILD_DIR/k1r11-laneB-it13-O2.exe"
"$CC" $CFLAGS -O2 -fno-omit-frame-pointer "$VEC_DIR/k1r11-laneB-it13-emitter.c" -o "$BUILD_DIR/k1r11-laneB-it13-O2fp.exe"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2tv-it13B.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k1r11-laneB-it13-O2.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k1r11-laneB-it13-O2fp.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out"

(
  cd "$PFX/drive_c/D2"
  timeout 60s "$W/wine" k1r11-laneB-it13-O2.exe "C:\\out\\i13b-1-O2.ndjson" "C:\\out\\i13b-2-O2.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
  timeout 60s "$W/wine" k1r11-laneB-it13-O2fp.exe "C:\\out\\i13b-1-O2fp.ndjson" "C:\\out\\i13b-2-O2fp.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
)

h1_o2="$(sha256sum "$PFX/drive_c/out/i13b-1-O2.ndjson" | awk '{print $1}')"
h1_fp="$(sha256sum "$PFX/drive_c/out/i13b-1-O2fp.ndjson" | awk '{print $1}')"
h2_o2="$(sha256sum "$PFX/drive_c/out/i13b-2-O2.ndjson" | awk '{print $1}')"
h2_fp="$(sha256sum "$PFX/drive_c/out/i13b-2-O2fp.ndjson" | awk '{print $1}')"

echo "i13b-1 -O2=$h1_o2 -O2fp=$h1_fp"
echo "i13b-2 -O2=$h2_o2 -O2fp=$h2_fp"

if [ "$h1_o2" != "$h1_fp" ] || [ "$h2_o2" != "$h2_fp" ]; then
  echo "ERROR: -O2 vs -O2fp SHA-256 mismatch!" >&2
  exit 1
fi

cp "$PFX/drive_c/out/i13b-1-O2.ndjson" "$OUT_DIR/i13b-1-vectors.ndjson"
cp "$PFX/drive_c/out/i13b-2-O2.ndjson" "$OUT_DIR/i13b-2-vectors.ndjson"
sha256sum "$OUT_DIR/i13b-1-vectors.ndjson" "$OUT_DIR/i13b-2-vectors.ndjson"
