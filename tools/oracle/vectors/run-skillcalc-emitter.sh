#!/usr/bin/env bash
# Build and run tools/oracle/vectors/skillcalc-emitter.c under Wine to produce
# or verify the [K3] SKILLCALC D2TV binary fixture:
#   - tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz
#
# Usage:
#   bash tools/oracle/vectors/run-skillcalc-emitter.sh           # generate fixture
#   bash tools/oracle/vectors/run-skillcalc-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k3"
OUT_FILE="$OUT_DIR/skillcalc-113c.d2tv.gz"

D2_DATA="${D2_DATA_DIR:-$HOME/d2-data}"
ORACLE_ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"

if [ -x "$ORACLE_ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32" ]; then
  CC="$ORACLE_ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32"
else
  CC="$(command -v i686-w64-mingw32-gcc-win32 || command -v i686-w64-mingw32-gcc)"
fi

if [ -x "$ORACLE_ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine/wine" ]; then
  WINE_DIR="$ORACLE_ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
  WINE_BIN="$WINE_DIR/wine"
  export WINESERVER="$WINE_DIR/wineserver"
  export WINELOADER="$WINE_DIR/wine"
else
  WINE_BIN="$(command -v wine)"
fi

CACHE_DIR="${D2_VECTOR_CACHE_DIR:-$HOME/.cache/k3-eg-vectors}"
PFX="$CACHE_DIR/pfx-skillcalc"
mkdir -p "$CACHE_DIR" "$OUT_DIR"

if [ ! -d "$PFX/drive_c/D2" ]; then
  rm -rf "$PFX"
  mkdir -p "$PFX/drive_c/D2"
  if [ -d "$ORACLE_ROOT/wine/prefix" ]; then
    cp -a "$ORACLE_ROOT/wine/prefix/." "$PFX/"
  fi
fi

for asset in Storm.dll Fog.dll D2Lang.dll D2Common.dll D2Net.dll D2Game.dll \
             d2data.mpq d2char.mpq d2sfx.mpq d2speech.mpq d2exp.mpq Patch_D2.mpq; do
  if [ ! -e "$PFX/drive_c/D2/$asset" ] && [ -e "$D2_DATA/$asset" ]; then
    ln -sf "$D2_DATA/$asset" "$PFX/drive_c/D2/$asset"
  fi
done

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc -I"$SCRIPT_DIR")

echo "[run-skillcalc-emitter] Compiling skillcalc-emitter.c (-O2 and -O2 -fno-omit-frame-pointer)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 "$SCRIPT_DIR/skillcalc-emitter.c" -o "$PFX/drive_c/D2/skillcalc-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer "$SCRIPT_DIR/skillcalc-emitter.c" -o "$PFX/drive_c/D2/skillcalc-emitter-fp.exe"

export WINEPREFIX="$PFX"
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

run_wine() {
  (cd "$PFX/drive_c/D2" && timeout 300 "$WINE_BIN" "$@")
}

echo "[run-skillcalc-emitter] Running skillcalc-emitter (-O2)..."
run_wine skillcalc-emitter-o2.exe "C:\\D2\\skillcalc-o2.d2tv"

echo "[run-skillcalc-emitter] Running skillcalc-emitter (-O2 -fno-omit-frame-pointer)..."
run_wine skillcalc-emitter-fp.exe "C:\\D2\\skillcalc-fp.d2tv"

SHA_O2="$(sha256sum "$PFX/drive_c/D2/skillcalc-o2.d2tv" | awk '{print $1}')"
SHA_FP="$(sha256sum "$PFX/drive_c/D2/skillcalc-fp.d2tv" | awk '{print $1}')"
rm -f "$PFX/drive_c/D2/skillcalc-fp.d2tv" "$PFX/drive_c/D2/skillcalc-emitter-o2.exe" "$PFX/drive_c/D2/skillcalc-emitter-fp.exe"

echo "  SKILLCALC -O2: $SHA_O2"
echo "  SKILLCALC -fp: $SHA_FP"

if [ "$SHA_O2" != "$SHA_FP" ]; then
  echo "[run-skillcalc-emitter] ERROR: -O2 and -O2 -fno-omit-frame-pointer outputs differ!" >&2
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  SHA_OLD="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  rm -f "$PFX/drive_c/D2/skillcalc-o2.d2tv"
  echo "  skillcalc-113c: $SHA_O2 (expected $SHA_OLD)"
  if [ "$SHA_O2" != "$SHA_OLD" ]; then
    echo "[run-skillcalc-emitter] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[run-skillcalc-emitter] --check PASSED (100% byte-identical)."
  exit 0
fi

gzip -n -9 -c "$PFX/drive_c/D2/skillcalc-o2.d2tv" > "$OUT_FILE"
rm -f "$PFX/drive_c/D2/skillcalc-o2.d2tv"
ls -lh "$OUT_FILE"
