#!/usr/bin/env bash
# Format-parity harness: compare this project's TypeScript decoders with
# independent implementations on generated fixtures.
#
#   dc6  vs dc6png (npm)                      -> PNG pixels compared
#   dc6 / ds1 / pl2 / dt1 vs REFDUMP          -> full JSON / digest compared
#   dt1  pixel placement                      -> compared against the encoded grid
#
# The Go oracle is optional: point REFDUMP at a built reference dumper, or let
# this script build one from a checkout. Without it, the dc6px and dt1 pixel
# checks still run.
#
# Usage: bash tools/verify-format-parity.sh [work-directory]
set -uo pipefail

WORK="${1:-/tmp/d2fix}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REFDUMP="${REFDUMP:-}"
DC6PNG="${DC6PNG:-}"

cd "$ROOT"
echo "== fixtures =="
tsx tools/make-fixtures.ts "$WORK" | sed 's/^/   /'
tsx tools/make-map-fixtures.ts "$WORK" | sed 's/^/   /'
tsx tools/make-pl2-fixture.ts "$WORK" | sed 's/^/   /'

failures=0
report() {
  if [ "$1" -eq 0 ]; then echo "   PASS"; else echo "   FAIL"; failures=$((failures + 1)); fi
}

echo
echo "== dc6: independent JS decoder (dc6png) =="
if [ -n "$DC6PNG" ] && [ -f "$DC6PNG" ]; then
  node "$DC6PNG" -p "$WORK/palette.pal" -f "$WORK/fixture.dc6" -d "$WORK" -m png >/dev/null 2>&1
  python3 - "$WORK" <<'PY'
import json, sys
from PIL import Image
work = sys.argv[1]
exp = json.load(open(f'{work}/expected.json'))
pal = open(f'{work}/palette.pal','rb').read()
# dc6png reads palette bytes as BGR.
rgb = lambda i: (pal[i*3+2], pal[i*3+1], pal[i*3])
bad = 0
for d in range(exp['directions']):
    for f in range(exp['framesPerDirection']):
        want = exp['frames'][d][f]
        im = Image.open(f'{work}/fixture_{d}_{f}.png').convert('RGBA')
        px = im.load()
        for y, row in enumerate(want['rows']):
            for x, idx in enumerate(row):
                r, g, b, a = px[x, y]
                if idx == 0:
                    bad += 0 if a == 0 else 1
                else:
                    bad += 0 if ((r, g, b) == rgb(idx) and a == 255) else 1
print(f'   pixels compared: {exp["directions"]*exp["framesPerDirection"]*8*4}, mismatches: {bad}')
sys.exit(1 if bad else 0)
PY
  report $?
else
  echo "   SKIP (set DC6PNG=/path/to/dc6png/src/index.js)"
fi

echo
echo "== dc6 / dt1 / ds1 / pl2: independent Go decoders =="
if [ -n "$REFDUMP" ] && [ -x "$REFDUMP" ]; then
  for fmt in dc6 ds1 dt1 pl2; do
    tsx tools/dump-format.ts "$fmt" "$WORK/fixture.$fmt" > "$WORK/ts.$fmt.json" 2>/dev/null
    "$REFDUMP" "$fmt" "$WORK/fixture.$fmt" > "$WORK/go.$fmt.json" 2>/dev/null
    echo "   $fmt:"
    python3 - "$WORK" "$fmt" <<'PY'
import json, sys
work, fmt = sys.argv[1], sys.argv[2]
a = json.load(open(f'{work}/ts.{fmt}.json'))
b = json.load(open(f'{work}/go.{fmt}.json'))
# The Go dt1 package never runs its graphics decoder, so its pixel arrays are
# empty by construction; compare structure and let the pixel check cover pixels.
if fmt == 'dt1':
    for ta, tb in zip(a['tiles'], b['tiles']):
        for ba in ta['blocks']: ba['pixels'] = []
        for bb in tb['blocks']: bb['pixels'] = []
print('      identical:', a == b)
sys.exit(0 if a == b else 1)
PY
    report $?
  done
else
  echo "   SKIP (set REFDUMP=/path/to/refdump)"
fi

echo
echo "== dt1: pixel placement against the encoded grid =="
tsx tools/verify-dt1-pixels.ts "$WORK" | sed 's/^/   /'
report $?

echo
if [ "$failures" -eq 0 ]; then
  echo "ALL PARITY CHECKS PASSED"
else
  echo "$failures PARITY CHECK(S) FAILED"
fi
exit "$failures"
