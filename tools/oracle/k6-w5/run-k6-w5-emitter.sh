#!/usr/bin/env bash
# Build and run tools/oracle/k6-w5/k6-w5-d2game-emitter.c under headless Wine
# to produce or verify the [K6] Wave 5 real-DLL D2Game.dll (0x6FC20000..0x6FCBFFFF)
# differential vector fixture:
#   - tests/fixtures/oracle/k6-w5/k6-w5-d2game-vectors.ndjson.gz
#
# Compiles under THREE optimization profiles (-O2, -O2 -fno-omit-frame-pointer, -O1)
# with -m32 -Wall -Wextra -Werror -static-libgcc, verifies register-only inline-asm
# constraints (0 "m"/"g"/"o"), runs all 3 against real Diablo II v1.13c DLLs under
# headless Wine, asserts 3-way SHA-256 identity + 150 unique Lo-VAs (>= 3 cases each,
# 0 degenerate VAs), and writes or checks the gzipped fixture.
#
# Usage:
#   bash tools/oracle/k6-w5/run-k6-w5-emitter.sh           # generate fixture
#   bash tools/oracle/k6-w5/run-k6-w5-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k6-w5"
OUT_FILE="$OUT_DIR/k6-w5-d2game-vectors.ndjson.gz"
DATATBLS_GZ="$REPO_ROOT/tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz"

ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
WINE_DIR="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

RUN_BASE="${D2_ORACLE_RUN_BASE:-$HOME/.cache/d2oracle-runs}"
mkdir -p "$OUT_DIR" "$RUN_BASE"

PFX="$(mktemp -d "$RUN_BASE/k6-w5-wine.XXXXXX")"
cleanup() {
  WINESERVER="$WINE_DIR/wineserver" WINEPREFIX="$PFX" "$WINE_DIR/wineserver" -k 2>/dev/null || true
  rm -rf "$PFX"
}
trap cleanup EXIT

# 1. Verify register-only inline-asm constraints (zero "m", "g", "o")
python3 -B - "$SCRIPT_DIR/k6-w5-d2game-emitter.c" << 'PYEOF'
import re, sys
code = open(sys.argv[1], encoding="utf-8").read()
code = re.sub(r'/\*.*?\*/|//[^\n]*', ' ', code, flags=re.S)
blocks = re.findall(r'__asm__\s*(?:volatile)?\s*\((.*?)\);', code, re.S)
bad = []
for idx, blk in enumerate(blocks):
    # Split on ':' tokens strictly outside C string literals
    parts = []
    cur = []
    in_str = False
    esc = False
    for ch in blk:
        if esc:
            cur.append(ch); esc = False; continue
        if ch == '\\' and in_str:
            cur.append(ch); esc = True; continue
        if ch == '"':
            in_str = not in_str; cur.append(ch); continue
        if ch == ':' and not in_str:
            parts.append(''.join(cur)); cur = []; continue
        cur.append(ch)
    parts.append(''.join(cur))
    for sec in parts[1:3]:
        for m in re.finditer(r'"([^"]*)"', sec):
            cstr = m.group(1)
            if any(ch in cstr for ch in ('m', 'g', 'o')):
                bad.append((idx, cstr))
if bad:
    raise SystemExit(f"[k6-w5] Forbidden inline-asm constraints found: {bad}")
print(f"[k6-w5] OK: {len(blocks)} inline-asm block(s) verified (register-only constraints)")
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

echo "[k6-w5] Compiling k6-w5-d2game-emitter.c (-O2, -O2 -fno-omit-frame-pointer, -O1)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 \
  "$SCRIPT_DIR/k6-w5-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w5-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer \
  "$SCRIPT_DIR/k6-w5-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w5-emitter-fp.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O1 \
  "$SCRIPT_DIR/k6-w5-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-w5-emitter-o1.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

echo "[k6-w5] Running k6-w5-emitter-o2.exe under headless Wine..."
(
  cd "$PFX/drive_c/D2"
  timeout 120s "$WINE_DIR/wine" k6-w5-emitter-o2.exe \
    "C:\\D2\\d2game-datatbls-113c.img" \
    "C:\\D2\\vectors-o2.ndjson" </dev/null
  "$WINE_DIR/wineserver" -k 2>/dev/null || true
)

echo "[k6-w5] Running k6-w5-emitter-fp.exe under headless Wine..."
(
  cd "$PFX/drive_c/D2"
  timeout 120s "$WINE_DIR/wine" k6-w5-emitter-fp.exe \
    "C:\\D2\\d2game-datatbls-113c.img" \
    "C:\\D2\\vectors-fp.ndjson" </dev/null
  "$WINE_DIR/wineserver" -k 2>/dev/null || true
)

echo "[k6-w5] Running k6-w5-emitter-o1.exe under headless Wine..."
(
  cd "$PFX/drive_c/D2"
  timeout 120s "$WINE_DIR/wine" k6-w5-emitter-o1.exe \
    "C:\\D2\\d2game-datatbls-113c.img" \
    "C:\\D2\\vectors-o1.ndjson" </dev/null
  "$WINE_DIR/wineserver" -k 2>/dev/null || true
)

SHA_O2="$(sha256sum "$PFX/drive_c/D2/vectors-o2.ndjson" | awk '{print $1}')"
SHA_FP="$(sha256sum "$PFX/drive_c/D2/vectors-fp.ndjson" | awk '{print $1}')"
SHA_O1="$(sha256sum "$PFX/drive_c/D2/vectors-o1.ndjson" | awk '{print $1}')"

echo "  k6-w5 -O2: $SHA_O2"
echo "  k6-w5 -fp: $SHA_FP"
echo "  k6-w5 -O1: $SHA_O1"

if [ "$SHA_O2" != "$SHA_FP" ] || [ "$SHA_O2" != "$SHA_O1" ]; then
  echo "[k6-w5] ERROR: Compiler-profile SHA-256 mismatch!" >&2
  exit 1
fi

# 2. Validate exact 150 unique Lo-VA targets, >= 3 cases each, 0 degenerate VAs
python3 -B - "$PFX/drive_c/D2/vectors-o2.ndjson" << 'PYEOF'
import json, sys
from collections import defaultdict

by_va = defaultdict(list)
lines = [l for l in open(sys.argv[1], encoding="utf-8").read().splitlines() if l.strip()]
for line in lines:
    row = json.loads(line)
    va = row["va"]
    va_num = int(va, 16)
    if not (0x6FC20000 <= va_num <= 0x6FCBFFFF):
        raise SystemExit(f"[k6-w5] VA out of Lo-VA firewall range: {va}")
    sig = (
        row["asserted"],
        row["assertLine"],
        row["ret"],
        json.dumps(row["postMem"], sort_keys=True),
        row["heapTop"],
        row["heapHex"],
    )
    by_va[va].append(sig)

under3 = [(va, len(v)) for va, v in sorted(by_va.items()) if len(v) < 3]
degen  = [(va, len(v), len(set(v))) for va, v in sorted(by_va.items()) if len(set(v)) < 2]
print(f"[k6-w5] Gate: unique_VAs={len(by_va)}/150, total_vectors={len(lines)}, under3={len(under3)}, degen={len(degen)}")
if len(by_va) != 150 or under3 or degen:
    raise SystemExit(f"[k6-w5] Vector gate FAILED: unique_VAs={len(by_va)}, under3={under3}, degen={degen}")
PYEOF

if [ "${1:-}" = "--check" ]; then
  SHA_OLD="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  echo "  expected:  $SHA_OLD"
  if [ "$SHA_O2" != "$SHA_OLD" ]; then
    echo "[k6-w5] ERROR: Reproducibility check failed!" >&2
    exit 1
  fi
  echo "[k6-w5] --check PASSED (100% 3-way SHA-256 identical)."
  exit 0
fi

gzip -n -9 -c "$PFX/drive_c/D2/vectors-o2.ndjson" > "$OUT_FILE"
ls -lh "$OUT_FILE"
