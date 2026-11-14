#!/usr/bin/env bash
# Compiles tools/oracle/vectors/k1r11-laneA-it13-emitter.c with bundled MinGW
# under BOTH -O2 and -O2 -fno-omit-frame-pointer (-Wall -Wextra -Werror), runs
# both against the real Diablo II v1.13c D2Common.dll / Fog.dll / Storm.dll
# under Wine, asserts SHA-256 identity across -O2 and -O2fp, and writes:
#   - tests/fixtures/oracle/k1/i13a-1-vectors.ndjson (22 VAs)
#   - tests/fixtures/oracle/k1/i13a-2-vectors.ndjson (11 VAs)
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/tests/fixtures/oracle/k1}"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-$ROOT/build}"
mkdir -p "$BUILD_DIR" "$OUT_DIR"

COMMON_FLAGS="-Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc"
"$CC" -O2 $COMMON_FLAGS -I"$VEC_DIR" "$VEC_DIR/k1r11-laneA-it13-emitter.c" -o "$BUILD_DIR/k1r11-laneA-it13-o2.exe"
"$CC" -O2 -fno-omit-frame-pointer $COMMON_FLAGS -I"$VEC_DIR" "$VEC_DIR/k1r11-laneA-it13-emitter.c" -o "$BUILD_DIR/k1r11-laneA-it13-fp.exe"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2tv-k1r11-laneA.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k1r11-laneA-it13-o2.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k1r11-laneA-it13-fp.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out-o2" "$PFX/drive_c/out-fp"

(
  cd "$PFX/drive_c/D2"
  "$W/wine" k1r11-laneA-it13-o2.exe "C:\\out-o2\\i13a-1-vectors.ndjson" "C:\\out-o2\\i13a-2-vectors.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
  "$W/wine" k1r11-laneA-it13-fp.exe "C:\\out-fp\\i13a-1-vectors.ndjson" "C:\\out-fp\\i13a-2-vectors.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
)

H1_O2="$(sha256sum "$PFX/drive_c/out-o2/i13a-1-vectors.ndjson" | awk '{print $1}')"
H1_FP="$(sha256sum "$PFX/drive_c/out-fp/i13a-1-vectors.ndjson" | awk '{print $1}')"
H2_O2="$(sha256sum "$PFX/drive_c/out-o2/i13a-2-vectors.ndjson" | awk '{print $1}')"
H2_FP="$(sha256sum "$PFX/drive_c/out-fp/i13a-2-vectors.ndjson" | awk '{print $1}')"

if [[ "$H1_O2" != "$H1_FP" ]]; then
  echo "ERROR: I13A-1 SHA-256 mismatch (-O2=$H1_O2 vs -O2fp=$H1_FP)" >&2
  exit 1
fi
if [[ "$H2_O2" != "$H2_FP" ]]; then
  echo "ERROR: I13A-2 SHA-256 mismatch (-O2=$H2_O2 vs -O2fp=$H2_FP)" >&2
  exit 1
fi

cp "$PFX/drive_c/out-o2/i13a-1-vectors.ndjson" "$OUT_DIR/i13a-1-vectors.ndjson"
cp "$PFX/drive_c/out-o2/i13a-2-vectors.ndjson" "$OUT_DIR/i13a-2-vectors.ndjson"
echo "OK: -O2 == -O2fp parity verified"
sha256sum "$OUT_DIR/i13a-1-vectors.ndjson" "$OUT_DIR/i13a-2-vectors.ndjson"
