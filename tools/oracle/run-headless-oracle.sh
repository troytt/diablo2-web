#!/usr/bin/env bash
# Run one scenario JSON on the headless 1.13c server host (d2host-113c.exe).
#
# Zero Xvfb, zero Game.exe, zero GUI menu clicks, zero 25 fps wall-clock sleep.
# Supports Normal (0), Nightmare (1), and Hell (2) difficulties directly.
#
# Usage: tools/oracle/run-headless-oracle.sh <scenario.json> <out.ndjson>
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
ROOT=${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}
SCN=$(realpath "${1:?scenario.json}")
OUT=$(realpath -m "${2:?out.ndjson}")
WORK="$OUT.d"
rm -rf "$WORK"
mkdir -p "$WORK"

# Flatten scenario JSON into d2oracle's scenario.txt format + shell variables.
eval "$(python3 - "$SCN" "$WORK/scenario.txt" <<'EOF'
import json, shlex, sys
s = json.load(open(sys.argv[1]))
with open(sys.argv[2], 'w') as f:
    f.write(f"frames {int(s['frames'])}\n")
    f.write(f"states {int(s.get('stateCount', 183))}\n")
    if s.get('statIds'):
        f.write('stats ' + ','.join(str(int(x)) for x in s['statIds']) + '\n')
    if s.get('oracleSetExp'):
        f.write('setexp ' + ' '.join(str(int(v)) for v in s['oracleSetExp']) + '\n')
    if s.get('oracleSetGold'):
        f.write('setgold ' + ' '.join(str(int(v)) for v in s['oracleSetGold']) + '\n')
    for eq in s.get('oracleEquip', []):
        f.write(f"equip {int(eq[0])} {str(eq[1])} {int(eq[2])} {int(eq[3])} {int(eq[4])}\n")
    if s.get('oracleDumpColl'):
        f.write('dumpcoll ' + ' '.join(str(int(v)) for v in s['oracleDumpColl']) + '\n')
    for md in s.get('oracleMemDump', []):
        f.write('memdump ' + ' '.join(str(int(v)) for v in md) + '\n')
    for fr in s.get('oracleFnRec', []):
        f.write('fnrec ' + ' '.join(str(v) for v in fr) + '\n')
    if s.get('oracleOrderLog'):
        f.write('orderlog ' + ' '.join(str(int(v)) for v in s['oracleOrderLog']) + '\n')
    if s.get('oracleAnimDump'):
        f.write('animdump ' + ' '.join(str(int(v)) for v in s['oracleAnimDump']) + '\n')
    for st in s.get('oracleSteer', []):
        f.write('steer ' + ' '.join(str(int(v)) for v in st) + '\n')
    for i in s.get('inputs', []):
        f.write(f"in {int(i['frame'])} {i['c2s'].replace(' ', '').lower()}\n")
print('SEED=%d' % int(s['seed']))
print('SAVE=%s' % shlex.quote(s['save']))
print('FRAMES=%d' % int(s['frames']))
print('DIFF=%d' % int(s.get('difficulty', 0)))
EOF
)"

case "$SAVE" in /*) ;; *) SAVE="$REPO/$SAVE" ;; esac

BUILD_DIR=${ORACLE_BUILD:-$ROOT/build}
"$HERE/hook/build.sh" "$BUILD_DIR" >/dev/null
"$HERE/headless/build.sh" "$BUILD_DIR" >/dev/null

# Use an isolated ephemeral WINEPREFIX if ORACLE_PREFIX is unset so concurrent
# headless runs never collide on C:\oracle or wineserver.
CLEAN_PREFIX=0
if [ -n "${ORACLE_PREFIX:-}" ]; then
  PFX="$ORACLE_PREFIX"
else
  mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
  PFX=$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/d2host-pfx.XXXXXX")
  cp -a "$ROOT/wine/prefix/." "$PFX/"
  CLEAN_PREFIX=1
fi
trap 'if [ "$CLEAN_PREFIX" = 1 ]; then rm -rf "$PFX"; fi' EXIT

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG=${WINEDEBUG:--all}
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

C="$PFX/drive_c"
mkdir -p "$C/oracle/out" "$C/D2/Save"
rm -f "$C/oracle/out/"* "$C/oracle/menu.txt" "$C/D2/Save/"*
cp "$WORK/scenario.txt" "$C/oracle/scenario.txt"
cp "$SAVE" "$C/D2/Save/Oracle.d2s"
cp "$BUILD_DIR/d2oracle.dll" "$BUILD_DIR/d2host-113c.exe" "$C/D2/"

cd "$C/D2"
rc=0
"$W/wine" d2host-113c.exe \
  --seed "$SEED" \
  --frames "$FRAMES" \
  --difficulty "$DIFF" \
  --oracle-dll "d2oracle.dll" \
  >"$WORK/host.log" 2>&1 || rc=$?
"$W/wineserver" -k 2>/dev/null || true

if [ "$rc" -ne 0 ] || [ ! -f "$C/oracle/out/done" ]; then
  echo "headless oracle did not reach frame $FRAMES (rc=$rc; see $WORK/host.log)" >&2
  cat "$WORK/host.log" >&2 2>/dev/null || true
  cat "$C/oracle/out/log.txt" >&2 2>/dev/null || true
  exit 1
fi
cp "$C/oracle/out/"* "$WORK/" 2>/dev/null || true
cp "$WORK/trace.ndjson" "$OUT"
cat "$WORK/host.log"
echo "headless oracle trace: $OUT ($(wc -l <"$OUT") lines)"
