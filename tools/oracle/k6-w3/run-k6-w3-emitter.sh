#!/usr/bin/env bash
# Compiles tools/oracle/k6-w3/k6-w3-d2game-emitter.c with bundled MinGW-w64 under
# THREE optimization profiles (-O2, -O2 -fno-omit-frame-pointer, and
# -O2 -ffloat-store -fexcess-precision=standard) with -Wall -Wextra -Werror,
# verifies register-only inline-asm constraints (zero "m"/"g"/"o"), executes
# all 3 binaries against real Diablo II v1.13c D2Game.dll + D2Common.dll under
# headless Wine, asserts 3-way SHA-256 identity + 125/125 VAs >= 3 vectors + degen=0,
# and writes tests/fixtures/oracle/k6-w3/k6-w3-d2game-vectors.ndjson.gz.
set -euo pipefail

K6_W3_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$K6_W3_DIR/../../.." && pwd)"
OUT_GZ="${1:-$REPO_ROOT/tests/fixtures/oracle/k6-w3/k6-w3-d2game-vectors.ndjson.gz}"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
RUN_BASE="${TMPDIR:-$HOME/.cache/d2oracle-runs}"
mkdir -p "$RUN_BASE" "$(dirname "$OUT_GZ")"
WORK_DIR="$(mktemp -d "$RUN_BASE/k6-w3-emitter-XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

BUILD_DIR="$WORK_DIR/build"
PFX="$WORK_DIR/wineprefix"
mkdir -p "$BUILD_DIR"

python3 -B - "$K6_W3_DIR/k6-w3-d2game-emitter.c" << 'PYEOF'
import re, sys
code = open(sys.argv[1], encoding="utf-8").read()
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
print(f"OK: {len(blocks)} inline-asm block(s) verified (register-only constraints)")
PYEOF

COMMON_FLAGS="-Wall -Wextra -Werror -Wno-cast-function-type -static-libgcc"
"$CC" -O2 $COMMON_FLAGS "$K6_W3_DIR/k6-w3-d2game-emitter.c" -o "$BUILD_DIR/k6-w3-o2.exe"
"$CC" -O2 -fno-omit-frame-pointer $COMMON_FLAGS "$K6_W3_DIR/k6-w3-d2game-emitter.c" -o "$BUILD_DIR/k6-w3-fp.exe"
"$CC" -O2 -ffloat-store -fexcess-precision=standard $COMMON_FLAGS "$K6_W3_DIR/k6-w3-d2game-emitter.c" -o "$BUILD_DIR/k6-w3-fstore.exe"

python3 -B - "$ROOT/wine/prefix" "$PFX" << 'PYEOF'
import shutil, sys
src, dst = sys.argv[1], sys.argv[2]
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst, symlinks=True, ignore_dangling_symlinks=True)
PYEOF

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/k6-w3-o2.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k6-w3-fp.exe" "$PFX/drive_c/D2/"
cp "$BUILD_DIR/k6-w3-fstore.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out-o2" "$PFX/drive_c/out-fp" "$PFX/drive_c/out-fstore"

(
  cd "$PFX/drive_c/D2"
  timeout 60s "$W/wine" k6-w3-o2.exe "C:\\out-o2\\vectors.ndjson" </dev/null
  "$W/wineserver" -k 2>/dev/null || true
  timeout 60s "$W/wine" k6-w3-fp.exe "C:\\out-fp\\vectors.ndjson" </dev/null
  "$W/wineserver" -k 2>/dev/null || true
  timeout 60s "$W/wine" k6-w3-fstore.exe "C:\\out-fstore\\vectors.ndjson" </dev/null
  "$W/wineserver" -k 2>/dev/null || true
)

H_O2="$(sha256sum "$PFX/drive_c/out-o2/vectors.ndjson" | awk '{print $1}')"
H_FP="$(sha256sum "$PFX/drive_c/out-fp/vectors.ndjson" | awk '{print $1}')"
H_FS="$(sha256sum "$PFX/drive_c/out-fstore/vectors.ndjson" | awk '{print $1}')"

if [[ "$H_O2" != "$H_FP" || "$H_O2" != "$H_FS" ]]; then
  echo "ERROR: SHA-256 mismatch (-O2=$H_O2 vs -O2fp=$H_FP vs -O2fstore=$H_FS)" >&2
  exit 1
fi

python3 -B - "$PFX/drive_c/out-o2/vectors.ndjson" << 'PYEOF'
import json, sys
from collections import defaultdict

by_va = defaultdict(list)
by_mod = defaultdict(set)
lines = [l for l in open(sys.argv[1], encoding="utf-8").read().splitlines() if l.strip()]
assert json.loads(lines[0]).get("k") == "tables", "first line must be tables header"
for line in lines[1:]:
    row = json.loads(line)
    out = row["outputs"]
    asr = row.get("expectedAssert", {}).get("line", -1)
    key = f"{row['mod']}:{row['va']}"
    by_va[key].append((asr, out["eax"], out["retMask"], out["workHex"]))
    by_mod[row["mod"]].add(row["va"])

degen = []
under3 = []
for key, outs in sorted(by_va.items()):
    if len(outs) < 3:
        under3.append((key, len(outs)))
    if len(set(outs)) < 2:
        degen.append((key, len(outs), len(set(outs))))

print(
    f"D2Common={len(by_mod['D2Common'])}/2, D2Game={len(by_mod['D2Game'])}/123, "
    f"total_VAs={len(by_va)}/125, total_vectors={len(lines)-1}, under3={len(under3)}, degen={len(degen)}"
)
if len(by_mod["D2Common"]) != 2 or len(by_mod["D2Game"]) != 123 or under3 or degen:
    raise SystemExit(f"Vector gate failed: VAs={len(by_va)}, under3={under3}, degen={degen}")
PYEOF

gzip -9n -c "$PFX/drive_c/out-o2/vectors.ndjson" > "$OUT_GZ"
echo "OK: 3-way SHA-256 parity verified ($H_O2)"
ls -lh "$OUT_GZ"
