#!/usr/bin/env bash
# Record kernel-replay inputs for one golden scenario via headless 1.13c server host (d2host-113c.exe):
#   snap   - boot snapshot (all units, timer pool, acts, active rooms + collision) at the end of BOOT_FRAME
#   cover  - function-entry coverage (every manifest D2Game + D2Common entry) for frames 1..N
# Verifies frame-by-frame determinism against tests/fixtures/oracle/golden/<scenario>.oracle.ndjson.gz
# before writing the gzipped fixture to DEST_DIR (default: tests/fixtures/oracle/k3/replay).
#
# Usage: tools/oracle/kern-replay/record-boot-headless.sh <scenario-name> <snap|cover> [work-dir]
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
NAME=${1:?scenario name}
MODE=${2:?snap|cover}
WORK=$(realpath -m "${3:-${TMPDIR:-/tmp}/k3-replay-rec-$NAME-$MODE}")
BOOT_FRAME=${BOOT_FRAME:-2}
SCN="$REPO/tests/fixtures/oracle/scenarios/$NAME.json"
GOLD="$REPO/tests/fixtures/oracle/golden/$NAME.oracle.ndjson.gz"
DEST=${DEST_DIR:-"$REPO/tests/fixtures/oracle/k3/replay"}
CLEAN_WORK=0
if [ $# -lt 3 ]; then
  CLEAN_WORK=1
fi
trap 'if [ "$CLEAN_WORK" = 1 ]; then rm -rf "$WORK"; fi' EXIT
mkdir -p "$WORK" "$DEST"

python3 - "$SCN" "$WORK/scenario.json" "$MODE" "$BOOT_FRAME" <<'EOF'
import json, sys
s = json.load(open(sys.argv[1]))
mode, boot = sys.argv[3], int(sys.argv[4])
if mode == 'snap':
    s['oracleSnapshot'] = [boot]
elif mode == 'cover':
    s['oracleCover'] = [1, int(s['frames'])]
else:
    sys.exit('mode must be snap or cover')
json.dump(s, open(sys.argv[2], 'w'), indent=1)
EOF

"$REPO/tools/oracle/run-headless-oracle.sh" "$WORK/scenario.json" "$WORK/trace.ndjson"

# Determinism: the recording run must reproduce the committed golden frame for frame.
python3 - "$GOLD" "$WORK/trace.ndjson" <<'EOF'
import gzip, json, sys
gold = [json.loads(l) for l in gzip.open(sys.argv[1], 'rt') if l.strip()]
run = [json.loads(l) for l in open(sys.argv[2]) if l.strip()]
gh, rh = gold[0], run[0]
gf = {r['frame']: r for r in gold[1:]}
rf = {r['frame']: r for r in run[1:]}
nf = len(gh['unitFields'])
ns = len(gh['statIds'])
def rows(fr, key, hdr_fields):
    out = {}
    for row in fr.get(key, []):
        out[row[0]] = row[:nf] + row[len(hdr_fields):len(hdr_fields) + ns]
    return out
keys = ('t0', 't1', 't3') if len(gh['unitFields']) == len(rh['unitFields']) else ('t0', 't1')
bad = 0
for f in sorted(gf):
    if f not in rf:
        print(f'frame {f} missing from run'); bad += 1; break
    for key in keys:
        a = rows(gf[f], key, gh['unitFields']); b = rows(rf[f], key, rh['unitFields'])
        if a != b:
            print(f'frame {f} {key} differs: golden={a} run={b}'[:400]); bad += 1; break
    if bad: break
print(f'determinism check ({",".join(keys)}): {len(gf)} golden frames, {"MISMATCH" if bad else "identical"}')
sys.exit(1 if bad else 0)
EOF

D="$WORK/trace.ndjson.d"
case "$MODE" in
  snap)
    src="$D/snap_$BOOT_FRAME.ndjson"
    out="$DEST/$NAME.snap-f$(printf %03d "$BOOT_FRAME").ndjson.gz"
    ;;
  cover)
    src="$D/cover.ndjson"
    out="$DEST/$NAME.coverage.ndjson.gz"
    ;;
esac
[ -s "$src" ] || { echo "missing $src (see $D/log.txt)" >&2; exit 1; }
gzip -9n -c "$src" >"$out"
echo "wrote $out ($(stat -c %s "$out") bytes, sha256 $(sha256sum "$out" | cut -d' ' -f1))"
