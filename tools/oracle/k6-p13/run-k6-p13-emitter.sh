#!/usr/bin/env bash
# Build and run tools/oracle/k6-p13/k6-p13-d2game-emitter.c under headless Wine
# to produce or verify the [K6-P13] real-DLL D2Game.dll Band C (0x6FCB0000..0x6FCDFFFF) fixture:
#   - tests/fixtures/oracle/k6-p13/k6-p13-d2game-vectors.ndjson.gz
#
# Covers:
#   - K6_P13_EXPECTED_VAS (default 48) net-new disassembly-verified D2Game.dll VAs
#     strictly inside 0x6FCB0000..0x6FCDFFFF (excluding the 9 Wave P8 VAs and <=5B no-ops)
#   - >= 3 non-degenerate cases per VA
#
# Compiles under THREE optimization profiles (-O2, -O2 -fno-omit-frame-pointer, -O1)
# with -m32 -Wall -Wextra -Werror -static-libgcc, verifies register-only inline-asm
# constraints (0 "m"/"g"/"o"), runs all 3 against real Diablo II v1.13c DLLs under
# headless Wine with stdout/stderr redirected to log files, asserts 3-way SHA-256
# identity + strict VA bounds + >= 3 cases & >= 2 distinct output signatures per VA,
# and writes or checks the gzipped fixture.
#
# Usage:
#   bash tools/oracle/k6-p13/run-k6-p13-emitter.sh           # generate fixture
#   bash tools/oracle/k6-p13/run-k6-p13-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k6-p13"
OUT_FILE="$OUT_DIR/k6-p13-d2game-vectors.ndjson.gz"
DATATBLS_GZ="$REPO_ROOT/tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz"
EXPECTED_VA_COUNT="${K6_P13_EXPECTED_VAS:-48}"

ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
if [ -z "${CC:-}" ]; then
  if [ -x "$ROOT/bin/i686-w64-mingw32-gcc-win32" ]; then
    CC="$ROOT/bin/i686-w64-mingw32-gcc-win32"
  else
    CC="$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32"
  fi
fi
WINE_DIR="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"

RUN_BASE="${D2_ORACLE_RUN_BASE:-$HOME/.cache/d2oracle-runs}"
mkdir -p "$OUT_DIR" "$RUN_BASE"

PFX="$(mktemp -d "$RUN_BASE/k6-p13-wine.XXXXXX")"
cleanup() {
  WINESERVER="$WINE_DIR/wineserver" WINEPREFIX="$PFX" "$WINE_DIR/wineserver" -k 2>/dev/null || true
  rm -rf "$PFX"
}
trap cleanup EXIT

# 1. Verify register-only inline-asm constraints (zero "m", "g", "o")
python3 -B - "$SCRIPT_DIR/k6-p13-d2game-emitter.c" << 'PYEOF'
import re, sys
code = open(sys.argv[1], encoding="utf-8").read()
code = re.sub(r'/\*.*?\*/|//[^\n]*', ' ', code, flags=re.S)
blocks = re.findall(r'__asm__\s*(?:volatile)?\s*\((.*?)\);', code, re.S)
bad = []
for idx, blk in enumerate(blocks):
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
    raise SystemExit(f"[k6-p13] Forbidden inline-asm constraints found: {bad}")
print(f"[k6-p13] OK: {len(blocks)} inline-asm block(s) verified (register-only constraints)")
PYEOF

cp -a "$ROOT/wine/prefix/." "$PFX/"
mkdir -p "$PFX/drive_c/D2"

D2_DATA_DIR="${D2_DATA_DIR:-$HOME/d2-data}"
for dll in Storm.dll Fog.dll D2Lang.dll D2CMP.dll D2Common.dll D2Net.dll D2Win.dll D2Game.dll; do
  if [ ! -f "$PFX/drive_c/D2/$dll" ] && [ -f "$D2_DATA_DIR/$dll" ]; then
    cp "$D2_DATA_DIR/$dll" "$PFX/drive_c/D2/$dll"
  fi
done

gzip -dc "$DATATBLS_GZ" > "$PFX/drive_c/D2/d2game-datatbls-113c.img"

CFLAGS_COMMON=(-m32 -Wall -Wextra -Werror -static-libgcc)

echo "[k6-p13] Compiling k6-p13-d2game-emitter.c (-O2, -O2 -fno-omit-frame-pointer, -O1)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 \
  "$SCRIPT_DIR/k6-p13-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-p13-d2game-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer \
  "$SCRIPT_DIR/k6-p13-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-p13-d2game-emitter-fp.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O1 \
  "$SCRIPT_DIR/k6-p13-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-p13-d2game-emitter-o1.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

for prof in o2 fp o1; do
  echo "[k6-p13] Running k6-p13-d2game-emitter-${prof}.exe under headless Wine..."
  if ! (
    cd "$PFX/drive_c/D2"
    timeout -k 10 180s "$WINE_DIR/wine" "k6-p13-d2game-emitter-${prof}.exe" \
      "C:\\D2\\d2game-datatbls-113c.img" \
      "C:\\D2\\vectors-${prof}.ndjson" \
      >"$PFX/drive_c/D2/wine-${prof}.stdout.log" \
      2>"$PFX/drive_c/D2/wine-${prof}.stderr.log" \
      </dev/null
  ); then
    echo "[k6-p13] Wine run failed for profile ${prof}; log output:" >&2
    cat "$PFX/drive_c/D2/wine-${prof}.stdout.log" >&2 || true
    cat "$PFX/drive_c/D2/wine-${prof}.stderr.log" >&2 || true
    exit 1
  fi
  "$WINE_DIR/wineserver" -k 2>/dev/null || true
done

# 2. Verify 3-way SHA-256 identity, strict Band C VA bounds, & non-degenerate vector quality
python3 -B - "$PFX/drive_c/D2/vectors-o2.ndjson" "$PFX/drive_c/D2/vectors-fp.ndjson" "$PFX/drive_c/D2/vectors-o1.ndjson" "$EXPECTED_VA_COUNT" << 'PYEOF'
import hashlib, json, sys
from collections import defaultdict

p_o2, p_fp, p_o1 = sys.argv[1:4]
expected_vas = int(sys.argv[4])
b_o2 = open(p_o2, "rb").read()
b_fp = open(p_fp, "rb").read()
b_o1 = open(p_o1, "rb").read()

h_o2 = hashlib.sha256(b_o2).hexdigest()
h_fp = hashlib.sha256(b_fp).hexdigest()
h_o1 = hashlib.sha256(b_o1).hexdigest()
if not (h_o2 == h_fp == h_o1):
    raise SystemExit(f"[k6-p13] 3-way SHA-256 MISMATCH:\n  -O2: {h_o2}\n  -fp: {h_fp}\n  -O1: {h_o1}")

by_va = defaultdict(list)
for line in b_o2.decode("utf-8").splitlines():
    if not line.strip():
        continue
    rec = json.loads(line)
    by_va[rec["va"]].append(rec)

if len(by_va) != expected_vas:
    raise SystemExit(f"[k6-p13] Expected exactly {expected_vas} unique VAs, got {len(by_va)}")

forbidden = {0x6FCB0000 + off for off in (0x1340, 0x6F40, 0xBEB0, 0xC1F0, 0xD160, 0xD980, 0xE610, 0xF3B0, 0x2DE60)}
noops = {0x6FCC3880, 0x6FCC3930, 0x6FCD8930}
out_of_range = []
forbidden_hit = []
noop_hit = []

def mem_diff(pre, post):
    pre_map = {b["addr"]: b["hex"] for b in pre}
    post_map = {b["addr"]: b["hex"] for b in post}
    return tuple(
        (a, pre_map.get(a, ""), post_map.get(a, ""))
        for a in sorted(set(pre_map) | set(post_map))
        if pre_map.get(a, "") != post_map.get(a, "")
    )

degen = []
for va, recs in sorted(by_va.items()):
    va_num = int(va, 16)
    if not (0x6FCB0000 <= va_num <= 0x6FCDFFFF):
        out_of_range.append(va)
    if va_num in forbidden:
        forbidden_hit.append(va)
    if va_num in noops:
        noop_hit.append(va)
    if len(recs) < 3:
        raise SystemExit(f"[k6-p13] VA {va} has only {len(recs)} cases (need >= 3)")
    sigs = set()
    for r in recs:
        sigs.add((
            r["asserted"],
            r["assertLine"],
            r["ret"],
            r["retMask"],
            mem_diff(r["preMem"], r["postMem"]),
            r["heapTop"],
            r["heapHex"],
        ))
    if len(sigs) < 2:
        degen.append(va)

if out_of_range:
    raise SystemExit(f"[k6-p13] VAs outside Band C 0x6FCB0000..0x6FCDFFFF: {out_of_range}")
if forbidden_hit:
    raise SystemExit(f"[k6-p13] Forbidden Wave P8 VAs included: {forbidden_hit}")
if noop_hit:
    raise SystemExit(f"[k6-p13] Trivial no-op VAs included: {noop_hit}")
if degen:
    raise SystemExit(f"[k6-p13] Degenerate VAs (< 2 distinct signatures): {degen}")

total = sum(len(v) for v in by_va.values())
print(f"[k6-p13] OK: 3-way SHA-256 identical ({h_o2}), {len(by_va)} unique VAs, {total} vectors")
PYEOF

if [ "${1:-}" = "--check" ]; then
  if [ ! -f "$OUT_FILE" ]; then
    echo "[k6-p13] --check FAILED: missing $OUT_FILE" >&2
    exit 1
  fi
  EXPECTED_SHA="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  ACTUAL_SHA="$(sha256sum "$PFX/drive_c/D2/vectors-o2.ndjson" | awk '{print $1}')"
  if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
    echo "[k6-p13] --check FAILED: fixture SHA-256 drift ($EXPECTED_SHA vs $ACTUAL_SHA)" >&2
    exit 1
  fi
  echo "[k6-p13] --check PASSED ($ACTUAL_SHA)"
else
  gzip -n -9 -c "$PFX/drive_c/D2/vectors-o2.ndjson" > "$OUT_FILE"
  echo "[k6-p13] Wrote $OUT_FILE ($(wc -c < "$OUT_FILE") bytes)"
fi
