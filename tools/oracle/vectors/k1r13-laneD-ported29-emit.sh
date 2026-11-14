#!/usr/bin/env bash
# Compiles tools/oracle/vectors/k1r13-laneD-ported29-emitter.c with bundled MinGW
# under THREE optimization profiles (-O2, -O2 -fno-omit-frame-pointer, and
# -O2 -ffloat-store -fexcess-precision=standard) with -Wall -Wextra -Werror,
# verifies zero forbidden inline-asm constraints ("m"/"g"/"o"), runs all 3 against
# real Diablo II v1.13c D2Common.dll / Fog.dll / Storm.dll under Wine (using
# shutil.copytree(..., symlinks=True, ignore_dangling_symlinks=True)), asserts
# 3-way SHA-256 identity + 29/29 VAs >= 3 vectors + degen=0, and writes:
#   - tests/fixtures/oracle/vectors/k1r13-i14d-1.ndjson
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/tests/fixtures/oracle/vectors}"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
SCRATCH="${LANE_D_SCRATCH:-$HOME/.cache/k1r13-laneD-ported29}"
BUILD_DIR="$SCRATCH/build"
mkdir -p "$BUILD_DIR" "$OUT_DIR"

python3 - "$VEC_DIR/k1r13-laneD-ported29-emitter.c" << 'PYEOF'
import re, sys
code = open(sys.argv[1]).read()
blocks = re.findall(r'__asm__\s*(?:volatile)?\s*\((.*?)\);', code, re.S)
bad = []
for idx, blk in enumerate(blocks):
    for sec in blk.split(':')[1:3]:
        for m in re.finditer(r'"([^"]*)"', sec):
            cstr = m.group(1)
            if any(ch in cstr for ch in ('m', 'g', 'o')):
                bad.append((idx, cstr))
if bad:
    raise SystemExit(f"Forbidden inline-asm constraints found: {bad}")
print(f"OK: {len(blocks)} inline-asm blocks verified (register-only constraints)")
PYEOF

COMMON_FLAGS="-Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc"
"$CC" -O2 $COMMON_FLAGS -I"$VEC_DIR" "$VEC_DIR/k1r13-laneD-ported29-emitter.c" -o "$BUILD_DIR/k1r13-laneD-o2.exe"
"$CC" -O2 -fno-omit-frame-pointer $COMMON_FLAGS -I"$VEC_DIR" "$VEC_DIR/k1r13-laneD-ported29-emitter.c" -o "$BUILD_DIR/k1r13-laneD-fp.exe"
"$CC" -O2 -ffloat-store -fexcess-precision=standard $COMMON_FLAGS -I"$VEC_DIR" "$VEC_DIR/k1r13-laneD-ported29-emitter.c" -o "$BUILD_DIR/k1r13-laneD-fstore.exe"

PFX="$SCRATCH/wineprefix"
python3 - "$ROOT/wine/prefix" "$PFX" << 'PYEOF'
import shutil, sys
src, dst = sys.argv[1], sys.argv[2]
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst, symlinks=True, ignore_dangling_symlinks=True)
PYEOF
trap 'rm -rf "$PFX"' EXIT

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k1r13-laneD-o2.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k1r13-laneD-fp.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k1r13-laneD-fstore.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out-o2" "$PFX/drive_c/out-fp" "$PFX/drive_c/out-fstore"

(
  cd "$PFX/drive_c/D2"
  timeout 60s "$W/wine" k1r13-laneD-o2.exe "C:\\out-o2\\k1r13-i14d-1.ndjson" </dev/null
  "$W/wineserver" -k 2>/dev/null || true
  timeout 60s "$W/wine" k1r13-laneD-fp.exe "C:\\out-fp\\k1r13-i14d-1.ndjson" </dev/null
  "$W/wineserver" -k 2>/dev/null || true
  timeout 60s "$W/wine" k1r13-laneD-fstore.exe "C:\\out-fstore\\k1r13-i14d-1.ndjson" </dev/null
  "$W/wineserver" -k 2>/dev/null || true
)

H_O2="$(sha256sum "$PFX/drive_c/out-o2/k1r13-i14d-1.ndjson" | awk '{print $1}')"
H_FP="$(sha256sum "$PFX/drive_c/out-fp/k1r13-i14d-1.ndjson" | awk '{print $1}')"
H_FS="$(sha256sum "$PFX/drive_c/out-fstore/k1r13-i14d-1.ndjson" | awk '{print $1}')"

if [[ "$H_O2" != "$H_FP" || "$H_O2" != "$H_FS" ]]; then
  echo "ERROR: SHA-256 mismatch (-O2=$H_O2 vs -O2fp=$H_FP vs -O2fstore=$H_FS)" >&2
  exit 1
fi

cp "$PFX/drive_c/out-o2/k1r13-i14d-1.ndjson" "$OUT_DIR/k1r13-i14d-1.ndjson"

python3 - "$OUT_DIR/k1r13-i14d-1.ndjson" << 'PYEOF'
import json, sys
from collections import defaultdict

by_va = defaultdict(list)
lines = open(sys.argv[1]).read().splitlines()
for line in lines:
    row = json.loads(line)
    out = row["outputs"]
    asr = row.get("expectedAssert", {}).get("line", -1)
    mem = tuple((m["base"], m["hex"]) for m in out.get("memory", []))
    by_va[row["va"]].append((asr, out.get("eax"), out.get("retMask"), mem))

degen = []
under3 = []
for va, outs in sorted(by_va.items()):
    if len(outs) < 3:
        under3.append((va, len(outs)))
    if len(set(outs)) < 2:
        degen.append((va, len(outs), len(set(outs))))

print(f"VAs={len(by_va)}/29, total_vectors={len(lines)}, under3={len(under3)}, degen={len(degen)}")
if len(by_va) != 29 or under3 or degen:
    raise SystemExit(f"Vector gate failed: VAs={len(by_va)}, under3={under3}, degen={degen}")
PYEOF

echo "OK: 3-way SHA-256 parity verified ($H_O2)"
sha256sum "$OUT_DIR/k1r13-i14d-1.ndjson"
