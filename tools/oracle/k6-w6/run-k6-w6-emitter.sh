#!/usr/bin/env bash
# Build and run tools/oracle/k6-w6/k6-w6-d2game-emitter.c under headless Wine
# to produce or verify the [K6] Wave 6 real-DLL D2Game.dll (0x6FCC0000..0x6FD18000)
# differential vector fixture:
#   - tests/fixtures/oracle/k6-w6/k6-w6-d2game-vectors.ndjson.gz
#
# Compiles under THREE optimization profiles (-O2, -O2 -fno-omit-frame-pointer, -O1)
# with -m32 -Wall -Wextra -Werror -static-libgcc, verifies register-only inline-asm
# constraints (zero "m"/"g"/"o"), asserts 3-way SHA-256 identity, VA range firewall
# (0x6FCC0000..0x6FD18000), >= 3 cases per VA, and zero degenerate VAs.
#
# Usage:
#   bash tools/oracle/k6-w6/run-k6-w6-emitter.sh           # generate fixture
#   bash tools/oracle/k6-w6/run-k6-w6-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k6-w6"
OUT_FILE="$OUT_DIR/k6-w6-d2game-vectors.ndjson.gz"
DATATBLS_GZ="$REPO_ROOT/tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz"
EXPECTED_VA_COUNT="${K6_W6_EXPECTED_VAS:-150}"

ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
WINE_DIR="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

RUN_BASE="${D2_ORACLE_RUN_BASE:-$HOME/.cache/d2oracle-runs}"
mkdir -p "$OUT_DIR" "$RUN_BASE"

PFX="$(mktemp -d "$RUN_BASE/k6-w6-wine.XXXXXX")"
cleanup() {
  WINESERVER="$WINE_DIR/wineserver" WINEPREFIX="$PFX" "$WINE_DIR/wineserver" -k 2>/dev/null || true
  rm -rf "$PFX"
}
trap cleanup EXIT

python3 -B - "$SCRIPT_DIR/k6-w6-d2game-emitter.c" << 'PYEOF'
import re, sys
code = open(sys.argv[1], encoding="utf-8").read()
blocks = re.findall(r'__asm__\s*(?:volatile)?\s*\((.*?)\);', code, re.S)
bad = []
for idx, blk in enumerate(blocks):
    # Split on ':' strictly outside C string literals and comments
    secs, cur, in_str, esc = [], [], False, False
    i = 0
    while i < len(blk):
        ch = blk[i]
        if in_str:
            cur.append(ch)
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
            i += 1
        elif ch == '/' and i + 1 < len(blk) and blk[i + 1] == '*':
            end = blk.find('*/', i + 2)
            i = len(blk) if end < 0 else end + 2
        elif ch == '"':
            in_str = True
            cur.append(ch)
            i += 1
        elif ch == ':':
            secs.append(''.join(cur))
            cur = []
            i += 1
        else:
            cur.append(ch)
            i += 1
    secs.append(''.join(cur))
    for sec in secs[1:3]:
        for m in re.finditer(r'"([^"]*)"', sec):
            cstr = m.group(1)
            if any(ch in cstr for ch in ('m', 'g', 'o')):
                bad.append((idx, cstr))
if bad:
    raise SystemExit(f"[k6-w6] Forbidden inline-asm constraints found: {bad}")
print(f"[k6-w6] OK: {len(blocks)} inline-asm block(s) verified (register-only constraints)")
PYEOF

cp -a "$ROOT/wine/prefix/." "$PFX/"
mkdir -p "$PFX/drive_c/D2"

D2_DATA_DIR="${D2_DATA_DIR:-$HOME/d2-data}"
for dll in Storm.dll Fog.dll D2Lang.dll D2CMP.dll D2Common.dll D2Net.dll D2Game.dll; do
  if [ ! -f "$PFX/drive_c/D2/$dll" ] && [ -f "$D2_DATA_DIR/$dll" ]; then
    cp "$D2_DATA_DIR/$dll" "$PFX/drive_c/D2/$dll"
  fi
done

gzip -dc "$DATATBLS_GZ" > "$PFX/drive_c/D2/d2game-datatbls-113c.img"

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -static-libgcc)

echo "[k6-w6] Compiling k6-w6-d2game-emitter.c (-O2, -O2 -fno-omit-frame-pointer, -O1)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 \
  "$SCRIPT_DIR/k6-w6-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w6-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer \
  "$SCRIPT_DIR/k6-w6-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w6-emitter-fp.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O1 \
  "$SCRIPT_DIR/k6-w6-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w6-emitter-o1.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

for prof in o2 fp o1; do
  echo "[k6-w6] Running k6-w6-emitter-${prof}.exe under headless Wine..."
  (
    cd "$PFX/drive_c/D2"
    timeout 120s "$WINE_DIR/wine" "k6-w6-emitter-${prof}.exe" \
      "C:\\D2\\d2game-datatbls-113c.img" \
      "C:\\D2\\vectors-${prof}.ndjson" </dev/null
    "$WINE_DIR/wineserver" -k 2>/dev/null || true
  )
done

SHA_O2="$(sha256sum "$PFX/drive_c/D2/vectors-o2.ndjson" | awk '{print $1}')"
SHA_FP="$(sha256sum "$PFX/drive_c/D2/vectors-fp.ndjson" | awk '{print $1}')"
SHA_O1="$(sha256sum "$PFX/drive_c/D2/vectors-o1.ndjson" | awk '{print $1}')"

echo "  k6-w6 -O2: $SHA_O2"
echo "  k6-w6 -fp: $SHA_FP"
echo "  k6-w6 -O1: $SHA_O1"

if [ "$SHA_O2" != "$SHA_FP" ] || [ "$SHA_O2" != "$SHA_O1" ]; then
  echo "[k6-w6] ERROR: Compiler-profile SHA-256 mismatch!" >&2
  exit 1
fi

python3 -B - "$PFX/drive_c/D2/vectors-o2.ndjson" "$EXPECTED_VA_COUNT" << 'PYEOF'
import json, sys
from collections import defaultdict

ndjson_path = sys.argv[1]
expected_vas = int(sys.argv[2])
by_va = defaultdict(list)
lines = [l for l in open(ndjson_path, encoding="utf-8").read().splitlines() if l.strip()]
out_of_range = []
for line in lines:
    row = json.loads(line)
    va_str = row["va"]
    va_num = int(va_str, 16)
    if not (0x6FCC0000 <= va_num <= 0x6FD18000):
        out_of_range.append(va_str)
    sig = (
        row["asserted"],
        row["assertLine"],
        row["ret"],
        row["retMask"],
        json.dumps(row["postMem"], sort_keys=True),
        row["heapTop"],
        row["heapHex"],
    )
    by_va[va_str].append(sig)

under3 = [(k, len(v)) for k, v in sorted(by_va.items()) if len(v) < 3]
degen = [(k, len(v), len(set(v))) for k, v in sorted(by_va.items()) if len(set(v)) < 2]
print(
    f"[k6-w6] VAs={len(by_va)}/{expected_vas}, vectors={len(lines)}, "
    f"out_of_range={len(out_of_range)}, under3={len(under3)}, degen={len(degen)}"
)
if out_of_range or under3 or degen or len(by_va) != expected_vas:
    raise SystemExit(
        f"[k6-w6] Vector gate failed: VAs={len(by_va)}/{expected_vas}, "
        f"out_of_range={out_of_range}, under3={under3}, degen={degen}"
    )
PYEOF

if [ "${1:-}" = "--check" ]; then
  SHA_OLD="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  echo "  expected:  $SHA_OLD"
  if [ "$SHA_O2" != "$SHA_OLD" ]; then
    echo "[k6-w6] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[k6-w6] --check PASSED (100% 3-way SHA-256 identical: $SHA_O2)."
  exit 0
fi

gzip -n -9 -c "$PFX/drive_c/D2/vectors-o2.ndjson" > "$OUT_FILE"
ls -lh "$OUT_FILE"
