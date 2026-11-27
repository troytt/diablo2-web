#!/usr/bin/env bash
# Compiles tools/oracle/vectors/fn-emitter.c with bundled MinGW and executes a
# data-driven .req.json request against real Diablo II v1.13c DLLs under Wine,
# producing a deterministic .ndjson.gz fixture (or verifying it with --check).
#
# Usage:
#   tools/oracle/vectors/run-fn-emitter.sh <request.req.json> <output.ndjson.gz>
#   tools/oracle/vectors/run-fn-emitter.sh --check <request.req.json> <output.ndjson.gz>
set -euo pipefail

VEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$VEC_DIR/../../.." && pwd)"
ROOT="${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}"
CC="${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}"
BUILD_DIR="${ORACLE_BUILD:-$ROOT/build}"
TSX="${TSX:-$REPO_ROOT/node_modules/.bin/tsx}"

CHECK_MODE=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_MODE=1
  shift
fi

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 [--check] <request.req.json> <output.ndjson.gz>" >&2
  exit 2
fi

REQ_JSON="$1"
OUT_GZ="$2"

if [[ ! -f "$REQ_JSON" ]]; then
  echo "error: request file not found: $REQ_JSON" >&2
  exit 2
fi

mkdir -p "$BUILD_DIR"
CFLAGS="-O2 -Wall -Wextra -Wno-cast-function-type -static-libgcc"

# Serialize fn-emitter.exe compilation across concurrent lanes
(
  flock -x 9
  if [[ "${FORCE_REBUILD:-0}" == "1" || ! -x "$BUILD_DIR/fn-emitter.exe" || "$VEC_DIR/fn-emitter.c" -nt "$BUILD_DIR/fn-emitter.exe" ]]; then
    "$CC" $CFLAGS -I"$VEC_DIR" "$VEC_DIR/fn-emitter.c" -o "$BUILD_DIR/fn-emitter.exe.tmp"
    mv -f "$BUILD_DIR/fn-emitter.exe.tmp" "$BUILD_DIR/fn-emitter.exe"
  fi
) 9>"$BUILD_DIR/fn-emitter.build.lock"

mkdir -p "${TMPDIR:-$HOME/.cache/d2oracle-runs}"
PFX="$(mktemp -d "${TMPDIR:-$HOME/.cache/d2oracle-runs}/fn-pfx.XXXXXX")"
trap 'rm -rf "$PFX"' EXIT
cp -a "$ROOT/wine/prefix/." "$PFX/"

W="$ROOT/wine/root/usr/lib/x86_64-linux-gnu/wine"
export WINEPREFIX="$PFX" WINESERVER="$W/wineserver" WINELOADER="$W/wine"
export WINEDEBUG="-all"
export WINEDLLOVERRIDES="mscoree,mshtml=;winex11.drv=;winedbg.exe=d"
unset DISPLAY

cp "$BUILD_DIR/fn-emitter.exe" "$PFX/drive_c/D2/"
mkdir -p "$PFX/drive_c/out"

"$TSX" "$VEC_DIR/fn-request.ts" "$REQ_JSON" "$PFX/drive_c/out/in.fnreq" >/dev/null

(
  cd "$PFX/drive_c/D2"
  "$W/wine" fn-emitter.exe "C:\\out\\in.fnreq" "C:\\out\\out.ndjson"
  "$W/wineserver" -k 2>/dev/null || true
)

RAW_NDJSON="$PFX/drive_c/out/out.ndjson"
if [[ ! -s "$RAW_NDJSON" ]]; then
  echo "error: fn-emitter produced empty output for $REQ_JSON" >&2
  exit 1
fi

if [[ "$CHECK_MODE" -eq 1 ]]; then
  if [[ ! -f "$OUT_GZ" ]]; then
    echo "error: --check target fixture does not exist: $OUT_GZ" >&2
    exit 1
  fi
  node - "$RAW_NDJSON" "$OUT_GZ" <<'EOF'
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const [rawPath, gzPath] = process.argv.slice(2);
const freshBuf = fs.readFileSync(rawPath);
const existingBuf = zlib.gunzipSync(fs.readFileSync(gzPath));
const freshSha = crypto.createHash('sha256').update(freshBuf).digest('hex');
const existingSha = crypto.createHash('sha256').update(existingBuf).digest('hex');
if (freshSha !== existingSha) {
  console.error(`MISMATCH in ${gzPath}:\n  expected (fresh DLL): ${freshSha}\n  actual   (on disk):   ${existingSha}`);
  process.exit(1);
}
console.log(`OK ${gzPath} sha256=${freshSha} (${freshBuf.length} bytes)`);
EOF
else
  mkdir -p "$(dirname "$OUT_GZ")"
  node - "$RAW_NDJSON" "$OUT_GZ" <<'EOF'
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const [rawPath, gzPath] = process.argv.slice(2);
const rawBuf = fs.readFileSync(rawPath);
const sha = crypto.createHash('sha256').update(rawBuf).digest('hex');
const gzBuf = zlib.gzipSync(rawBuf, { level: 9 });
fs.writeFileSync(gzPath, gzBuf);
console.log(`Wrote ${gzPath} (${gzBuf.length} gz / ${rawBuf.length} raw bytes, sha256=${sha})`);
EOF
fi
