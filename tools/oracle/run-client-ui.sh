#!/usr/bin/env bash
# Client display-value oracle (P5.4): run original 1.13c with the clientui.dll
# hook (tools/oracle/hook/clientui.dll.c, kb/ui/oracle-client-display-113c.md)
# and dump what the original D2Client displays (character sheet, per-skill
# attack/damage block, skill tree tooltips).
#
# Usage: tools/oracle/run-client-ui.sh <out_dir> [case...]
#   case: a class name (barbarian paladin amazon sorceress necromancer) = its
#         level-40 save in town, one capture 75 frames after entering; or a
#         capture scenario name (tests/fixtures/oracle/scenarios/<name>.json
#         with "captures": [[frame, label], ...], see make-p54-scenarios.py).
#   Default: the five classes and every p54-* scenario.
#   ORACLE_PREFIX  WINEPREFIX for this runner (give it its own copy, see run-oracle.sh)
# Output: <out_dir>/<case>/ui.ndjson (+ log.txt, inject.log, menu.log)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
OUT=$(realpath -m "${1:?out dir}")
shift
CASES=("$@")
if [ ${#CASES[@]} -eq 0 ]; then
  CASES=(barbarian paladin amazon sorceress necromancer)
  for f in "$REPO"/tests/fixtures/oracle/scenarios/p54-*.json; do
    [ -e "$f" ] && CASES+=("$(basename "$f" .json)")
  done
fi

save_for() {
  case "$1" in
    barbarian) echo barbarian-l40-warcries ;;
    paladin) echo paladin-l40-auras ;;
    amazon) echo amazon-l40-passives ;;
    sorceress) echo sorceress-l40-elemental ;;
    necromancer) echo necromancer-l40-curses-summons ;;
    *) return 1 ;;
  esac
}

status=0
for c in "${CASES[@]}"; do
  dir="$OUT/$c"
  rm -rf "$dir"
  mkdir -p "$dir"
  if s=$(save_for "$c"); then
    save="$REPO/tests/fixtures/oracle/saves/$s.d2s"
    secs=60
    unset ORACLE_SCENARIO
  else
    scn="$REPO/tests/fixtures/oracle/scenarios/$c.json"
    [ -f "$scn" ] || { echo "unknown case $c" >&2; status=1; continue; }
    eval "$(python3 - "$scn" "$dir/scenario.txt" <<'EOF'
import json, shlex, sys
s = json.load(open(sys.argv[1]))
with open(sys.argv[2], 'w') as f:
    for i in s.get('inputs', []):
        f.write(f"in {int(i['frame'])} {i['c2s'].replace(' ', '').lower()}\n")
    for fr, label in s['captures']:
        f.write(f"capture {int(fr)} {label}\n")
print('save=%s' % shlex.quote(s['save']))
print('secs=%d' % (30 + int(s['frames']) // 25 + 20))
EOF
)"
    case "$save" in /*) ;; *) save="$REPO/$save" ;; esac
    export ORACLE_SCENARIO="$dir/scenario.txt"
  fi
  ORACLE_DLL=clientui.dll ORACLE_SAVE="$save" \
    "$HERE/run-oracle.sh" "$HERE/menus/sp-first-char.txt" "$dir" "$secs" -w -ns -seed 12345 \
    >"$dir/run.log" 2>&1 || true
  if [ -f "$dir/done" ] && [ -s "$dir/ui.ndjson" ]; then
    echo "$c: $(wc -l <"$dir/ui.ndjson") lines -> $dir/ui.ndjson"
  else
    echo "$c: no complete ui.ndjson (see $dir/log.txt)" >&2
    status=1
  fi
done
exit $status
