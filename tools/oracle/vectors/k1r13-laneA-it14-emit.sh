#!/usr/bin/env bash
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/tests/fixtures/oracle/k1}"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-$ROOT/build}"
mkdir -p "$BUILD_DIR" "$OUT_DIR"

COMMON_FLAGS="-Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc"
"$CC" -O2 $COMMON_FLAGS -I"$VEC_DIR" "$VEC_DIR/k1r13-laneA-it14-emitter.c" -o "$BUILD_DIR/k1r13-laneA-it14-o2.exe"
"$CC" -O2 -fno-omit-frame-pointer $COMMON_FLAGS -I"$VEC_DIR" "$VEC_DIR/k1r13-laneA-it14-emitter.c" -o "$BUILD_DIR/k1r13-laneA-it14-fp.exe"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2tv-k1r13-laneA.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k1r13-laneA-it14-o2.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k1r13-laneA-it14-fp.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out-o2" "$PFX/drive_c/out-fp"

(
  cd "$PFX/drive_c/D2"
  timeout 60s "$W/wine" k1r13-laneA-it14-o2.exe "C:\out-o2\i14a-1-vectors.ndjson" "C:\out-o2\i14a-2-vectors.ndjson" "C:\out-o2\i14a-3-vectors.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
  timeout 60s "$W/wine" k1r13-laneA-it14-fp.exe "C:\out-fp\i14a-1-vectors.ndjson" "C:\out-fp\i14a-2-vectors.ndjson" "C:\out-fp\i14a-3-vectors.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
)

for f in i14a-1-vectors.ndjson i14a-2-vectors.ndjson i14a-3-vectors.ndjson; do
  H_O2="$(sha256sum "$PFX/drive_c/out-o2/$f" | awk '{print $1}')"
  H_FP="$(sha256sum "$PFX/drive_c/out-fp/$f" | awk '{print $1}')"
  if [[ "$H_O2" != "$H_FP" ]]; then
    echo "ERROR: $f SHA-256 mismatch (-O2=$H_O2 vs -O2fp=$H_FP)" >&2
    exit 1
  fi
  cp "$PFX/drive_c/out-o2/$f" "$OUT_DIR/$f"
done

echo "OK: -O2 == -O2fp parity verified for I14A-1, I14A-2, I14A-3"
sha256sum "$OUT_DIR/i14a-1-vectors.ndjson" "$OUT_DIR/i14a-2-vectors.ndjson" "$OUT_DIR/i14a-3-vectors.ndjson"
