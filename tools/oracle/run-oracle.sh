#!/usr/bin/env bash
# Run original 1.13c headless (Xvfb) with the oracle hook injected.
#
# Usage: tools/oracle/run-oracle.sh <menu.txt> <out_dir> [seconds] [game args...]
#   D2_ORACLE_ROOT  toolchain root (default: $HOME/.local/opt/d2oracle)
#   ORACLE_PREFIX   WINEPREFIX (default $D2_ORACLE_ROOT/wine/prefix); give each
#                   concurrent runner its own copy (cp -a) - runs end with wineserver -k
#   ORACLE_DLL      hook DLL to inject (default d2oracle.dll; built by hook/build.sh)
#   ORACLE_SAVE     .d2s copied as the only character (Save/Oracle.d2s)
#   ORACLE_SCENARIO hook scenario file (frames/stats/in lines)
#   ORACLE_SHOTS    if set, take screenshots every ORACLE_SHOT_EVERY seconds
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}
MENU=${1:?menu script}; OUT=${2:?out dir}; SECS=${3:-30}; shift 3 || true
ARGS=${*:--w -ns}
MENU=$(realpath "$MENU")
mkdir -p "$OUT"; OUT=$(realpath "$OUT")
if [ -n "${ORACLE_SAVE:-}" ]; then ORACLE_SAVE=$(realpath "$ORACLE_SAVE"); fi
if [ -n "${ORACLE_SCENARIO:-}" ]; then ORACLE_SCENARIO=$(realpath "$ORACLE_SCENARIO"); fi

R=$ROOT/wine/root
W=$R/usr/lib/x86_64-linux-gnu/wine
export WINEPREFIX=${ORACLE_PREFIX:-$ROOT/wine/prefix} WINESERVER=$W/wineserver WINELOADER=$W/wine
export WINEDEBUG=${WINEDEBUG:--all}
export WINEDLLOVERRIDES="mscoree,mshtml="

BUILD_DIR=${ORACLE_BUILD:-$ROOT/build}
"$HERE/hook/build.sh" "$BUILD_DIR" >/dev/null
C=$WINEPREFIX/drive_c
mkdir -p "$C/oracle/out" "$OUT"
rm -f "$C/oracle/out/"*
rm -f "$C/oracle/menu.txt"
if [ -n "${ORACLE_SCENARIO:-}" ]; then cp "$ORACLE_SCENARIO" "$C/oracle/scenario.txt"; fi
# Fresh save directory: exactly one character from ORACLE_SAVE (if given).
rm -rf "$C/D2/Save"
mkdir -p "$C/D2/Save"
if [ -n "${ORACLE_SAVE:-}" ]; then cp "$ORACLE_SAVE" "$C/D2/Save/Oracle.d2s"; fi
DLL=${ORACLE_DLL:-d2oracle.dll}
cp "$BUILD_DIR/$DLL" "$BUILD_DIR/oracle-inject.exe" "$C/D2/"

# Let Xvfb pick a free display number (-displayfd) so concurrent runs never
# share (and later kill) each other's X server.
if [ -n "${ORACLE_DISPLAY:-}" ]; then
  Xvfb "$ORACLE_DISPLAY" -screen 0 1024x768x24 >/dev/null 2>&1 &
  XPID=$!
  DISP=$ORACLE_DISPLAY
  sleep 1
else
  DFD=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1024x768x24 3>"$DFD" >/dev/null 2>&1 &
  XPID=$!
  for _ in $(seq 50); do [ -s "$DFD" ] && break; sleep 0.1; done
  DISP=":$(head -1 "$DFD")"
  rm -f "$DFD"
fi
trap 'kill $XPID 2>/dev/null || true' EXIT
export DISPLAY=$DISP
cd "$C/D2"
# shellcheck disable=SC2086
"$W/wine" oracle-inject.exe "$DLL" $ARGS >"$OUT/inject.log" 2>&1 &
WPID=$!
"$ROOT/venv/bin/python" "$HERE/menu-driver.py" "$MENU" "$C/oracle/out/done" >"$OUT/menu.log" 2>&1 &
MPID=$!
end=$((SECONDS + SECS))
shot=0
while [ $SECONDS -lt $end ]; do
  sleep "${ORACLE_SHOT_EVERY:-5}"
  shot=$((shot + 1))
  if [ -n "${ORACLE_SHOTS:-}" ]; then
    import -window root "$OUT/shot_$(printf %03d $shot).png" 2>/dev/null || true
  fi
  if [ -f "$C/oracle/out/done" ]; then break; fi
done
"$W/wineserver" -k || true
kill "$MPID" 2>/dev/null || true
wait "$WPID" 2>/dev/null || true
cp "$C/oracle/out/"* "$OUT/" 2>/dev/null || true
# Saves written by the game (used to author .d2s fixtures).
mkdir -p "$OUT/save" && cp "$C/D2/Save/"* "$OUT/save/" 2>/dev/null || true
echo "oracle run finished: $OUT"
