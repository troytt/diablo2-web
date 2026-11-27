#!/usr/bin/env bash
# Build and run tools/oracle/k6-p16b/k6-p16b-d2game-emitter.c under headless Wine
# to produce or verify the [K6-P16B] real-DLL D2Game.dll monster-spawn/AI/pet fixture:
#   - tests/fixtures/oracle/k6-p16b/k6-p16b-d2game-vectors.ndjson.gz
#
# Usage:
#   bash tools/oracle/k6-p16b/run-k6-p16b-emitter.sh           # generate fixture
#   bash tools/oracle/k6-p16b/run-k6-p16b-emitter.sh --check   # verify reproducibility & compiler-flag parity
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$REPO_ROOT/tests/fixtures/oracle/k6-p16b"
OUT_FILE="$OUT_DIR/k6-p16b-d2game-vectors.ndjson.gz"
DATATBLS_GZ="$REPO_ROOT/tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz"
EXPECTED_VA_COUNT="${K6_P16B_EXPECTED_VAS:-15}"

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

PFX="$(mktemp -d "$RUN_BASE/k6-p16b-wine.XXXXXX")"
cleanup() {
  WINESERVER="$WINE_DIR/wineserver" WINEPREFIX="$PFX" "$WINE_DIR/wineserver" -k 2>/dev/null || true
  rm -rf "$PFX" /tmp/p16b-scratch*
}
trap cleanup EXIT

# 1. Verify register-only inline-asm constraints (zero "m", "g", "o")
python3 -B - "$SCRIPT_DIR/k6-p16b-d2game-emitter.c" << 'PYEOF'
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
    raise SystemExit(f"[k6-p16b] Forbidden inline-asm constraints found: {bad}")
print(f"[k6-p16b] OK: {len(blocks)} inline-asm block(s) verified (register-only constraints)")
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

echo "[k6-p16b] Compiling k6-p16b-d2game-emitter.c (-O2, -O2 -fno-omit-frame-pointer, -O1)..."
"$CC" "${CFLAGS_COMMON[@]}" -O2 \
  "$SCRIPT_DIR/k6-p16b-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-p16b-d2game-emitter-o2.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O2 -fno-omit-frame-pointer \
  "$SCRIPT_DIR/k6-p16b-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-p16b-d2game-emitter-fp.exe"
"$CC" "${CFLAGS_COMMON[@]}" -O1 \
  "$SCRIPT_DIR/k6-p16b-d2game-emitter.c" \
  -o "$PFX/drive_c/D2/k6-p16b-d2game-emitter-o1.exe"

export WINEPREFIX="$PFX"
export WINESERVER="$WINE_DIR/wineserver"
export WINELOADER="$WINE_DIR/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY || true

for prof in o2 fp o1; do
  echo "[k6-p16b] Running k6-p16b-d2game-emitter-${prof}.exe under headless Wine..."
  if ! (
    cd "$PFX/drive_c/D2"
    timeout -k 10 180s "$WINE_DIR/wine" "k6-p16b-d2game-emitter-${prof}.exe" \
      "C:\\D2\\d2game-datatbls-113c.img" \
      "C:\\D2\\vectors-${prof}.ndjson" \
      >"$PFX/drive_c/D2/wine-${prof}.stdout.log" \
      2>"$PFX/drive_c/D2/wine-${prof}.stderr.log" \
      </dev/null
  ); then
    echo "[k6-p16b] Wine run failed for profile ${prof}; log output:" >&2
    cat "$PFX/drive_c/D2/wine-${prof}.stdout.log" >&2 || true
    cat "$PFX/drive_c/D2/wine-${prof}.stderr.log" >&2 || true
    exit 1
  fi
  "$WINE_DIR/wineserver" -k 2>/dev/null || true
done

# 2. Verify 3-way SHA-256 identity, exact 15-VA whitelist, zero prior overlap, & non-degenerate vector quality
python3 -B - "$PFX/drive_c/D2/vectors-o2.ndjson" "$PFX/drive_c/D2/vectors-fp.ndjson" "$PFX/drive_c/D2/vectors-o1.ndjson" "$EXPECTED_VA_COUNT" "$REPO_ROOT" << 'PYEOF'
import glob, gzip, hashlib, json, os, sys
from collections import defaultdict

p_o2, p_fp, p_o1 = sys.argv[1:4]
expected_vas = int(sys.argv[4])
repo_root = sys.argv[5]

b_o2 = open(p_o2, "rb").read()
b_fp = open(p_fp, "rb").read()
b_o1 = open(p_o1, "rb").read()

h_o2 = hashlib.sha256(b_o2).hexdigest()
h_fp = hashlib.sha256(b_fp).hexdigest()
h_o1 = hashlib.sha256(b_o1).hexdigest()
if not (h_o2 == h_fp == h_o1):
    raise SystemExit(f"[k6-p16b] 3-way SHA-256 MISMATCH:\n  -O2: {h_o2}\n  -fp: {h_fp}\n  -O1: {h_o1}")

expected_set = {
    "0x6FC3DD40", "0x6FC445A0", "0x6FC446D0", "0x6FC44950", "0x6FC44C70",
    "0x6FC44E70", "0x6FC451F0", "0x6FC561E0", "0x6FC66F70", "0x6FC679B0",
    "0x6FCB7F50", "0x6FCBD5B0", "0x6FCCB360", "0x6FCD1820", "0x6FCD1C90",
}

by_va = defaultdict(list)
for line in b_o2.decode("utf-8").splitlines():
    if not line.strip():
        continue
    rec = json.loads(line)
    by_va[rec["va"]].append(rec)

if len(by_va) != expected_vas:
    raise SystemExit(f"[k6-p16b] Expected exactly {expected_vas} unique VAs, got {len(by_va)}")

actual_set = set(by_va.keys())
if actual_set != expected_set:
    missing = sorted(expected_set - actual_set)
    extra = sorted(actual_set - expected_set)
    raise SystemExit(f"[k6-p16b] VA whitelist mismatch: missing={missing} extra={extra}")

prior_vas = set()
for p in glob.glob(os.path.join(repo_root, "tests/fixtures/oracle/k6*/*.ndjson.gz")):
    if "k6-p16b" in os.path.basename(p):
        continue
    if any(tag in os.path.basename(p) for tag in (".coverage.", ".oracle.", ".snap-")):
        continue
    with gzip.open(p, "rt", encoding="utf-8") as gf:
        for gl in gf:
            if gl.strip():
                gobj = json.loads(gl)
                va_val = gobj.get("va")
                if isinstance(va_val, str):
                    prior_vas.add(va_val.upper())

overlap = sorted(v for v in actual_set if v.upper() in prior_vas)
if overlap:
    raise SystemExit(f"[k6-p16b] Overlap with prior k6 fixtures: {overlap}")

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
    if len(recs) < 3:
        raise SystemExit(f"[k6-p16b] VA {va} has only {len(recs)} cases (need >= 3)")
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

if degen:
    raise SystemExit(f"[k6-p16b] Degenerate VAs (< 2 distinct signatures): {degen}")

total = sum(len(v) for v in by_va.values())
print(f"[k6-p16b] OK: 3-way SHA-256 identical ({h_o2}), {len(by_va)} unique VAs, {total} vectors")
PYEOF

if [ "${1:-}" = "--check" ]; then
  if [ ! -f "$OUT_FILE" ]; then
    echo "[k6-p16b] --check FAILED: missing $OUT_FILE" >&2
    exit 1
  fi
  EXPECTED_SHA="$(gzip -dc "$OUT_FILE" | sha256sum | awk '{print $1}')"
  ACTUAL_SHA="$(sha256sum "$PFX/drive_c/D2/vectors-o2.ndjson" | awk '{print $1}')"
  if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
    echo "[k6-p16b] --check FAILED: fixture SHA-256 drift ($EXPECTED_SHA vs $ACTUAL_SHA)" >&2
    exit 1
  fi
  echo "[k6-p16b] --check PASSED ($ACTUAL_SHA)"
else
  gzip -n -9 -c "$PFX/drive_c/D2/vectors-o2.ndjson" > "$OUT_FILE"
  echo "[k6-p16b] Wrote $OUT_FILE ($(wc -c < "$OUT_FILE") bytes)"
fi
