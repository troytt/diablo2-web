#!/usr/bin/env bash
# Run one scenario JSON (docs/oracle/scenario-schema.md) on the original game.
#
# Usage: tools/oracle/run-oracle-scenario.sh <scenario.json> <out.ndjson>
# The trace is written to <out.ndjson>; logs/screenshots go next to it in
# <out.ndjson>.d/ .
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
SCN=$(realpath "${1:?scenario.json}")
OUT=$(realpath -m "${2:?out.ndjson}")
WORK="$OUT.d"
mkdir -p "$WORK"

# Flatten the JSON into the hook's line format + shell variables.
eval "$(python3 - "$SCN" "$WORK/scenario.txt" "$REPO" <<'EOF'
import json, os, shlex, sys
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
    for fr in s.get('oracleSnapshot', []):
        f.write(f"snapshot {int(fr)}\n")
    if s.get('oracleCover'):
        # Function-entry coverage over every reachable manifest function (D2Game + D2Common).
        lo, hi = (int(v) for v in s['oracleCover'])
        f.write(f"cover {lo} {hi}\n")
        man = json.load(open(os.path.join(sys.argv[3], 'tools/oracle/callgraph/manifest-113c.json')))
        for fn in man['functions']:
            mod = {'D2Game': 'g', 'D2Common': 'c'}[fn['module']]
            f.write(f"cva {mod} {fn['va'][2:].lower()}\n")
    for st in s.get('oracleSteer', []):
        f.write('steer ' + ' '.join(str(int(v)) for v in st) + '\n')
    for i in s.get('inputs', []):
        f.write(f"in {int(i['frame'])} {i['c2s'].replace(' ', '').lower()}\n")
print('SEED=%d' % int(s['seed']))
print('SAVE=%s' % shlex.quote(s['save']))
print('FRAMES=%d' % int(s['frames']))
print('MENU=%s' % shlex.quote(s.get('oracleMenu', 'tools/oracle/menus/sp-first-char.txt')))
print('DIFF=%d' % int(s.get('difficulty', 0)))
EOF
)"

if [ "$DIFF" != 0 ]; then
  echo "difficulty $DIFF needs a difficulty-select menu script" >&2
  exit 2
fi

# Menu (~14 s) + game load + simulated frames at 25 fps + margin.
SECS=${ORACLE_SECS:-$((30 + FRAMES / 25 + 10))}
cd "$REPO"
case "$SAVE" in /*) ;; *) SAVE="$REPO/$SAVE" ;; esac
case "$MENU" in /*) ;; *) MENU="$REPO/$MENU" ;; esac
ORACLE_SCENARIO="$WORK/scenario.txt" ORACLE_SAVE="$SAVE" \
  "$HERE/run-oracle.sh" "$MENU" "$WORK" "$SECS" -w -ns -seed "$SEED"

if [ ! -f "$WORK/done" ]; then
  echo "oracle did not reach frame $FRAMES (see $WORK/log.txt)" >&2
  exit 1
fi
cp "$WORK/trace.ndjson" "$OUT"
echo "oracle trace: $OUT ($(wc -l <"$OUT") lines)"
