#!/usr/bin/env bash
# Build the oracle injector and hook DLLs with the rootless i686 mingw toolchain.
# Safe to call concurrently: outputs are rebuilt only when a source is newer,
# and replaced atomically (build to a temp file, then mv).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}
CC=${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}
OUT=${1:-$ROOT/build}
mkdir -p "$OUT"
CFLAGS="-O2 -Wall -Wextra -Wno-unused-parameter -static-libgcc"

build() { # <output> <source> [extra flags...]
  local out=$1 src=$2 src_hash old_hash tmp
  shift 2
  src_hash=$(sha256sum "$src" | cut -d' ' -f1)
  old_hash=$(cat "$out.sha256" 2>/dev/null || true)
  if [ -f "$out" ] && [ "$out" -nt "$src" ] && [ "$src_hash" = "$old_hash" ]; then return; fi
  tmp=$(mktemp "$OUT/.build.XXXXXX")
  $CC $CFLAGS -o "$tmp" "$src" "$@"
  mv -f "$tmp" "$out"
  printf '%s\n' "$src_hash" > "$out.sha256"
}

build "$OUT/oracle-inject.exe" "$HERE/injector.c"
build "$OUT/d2oracle.dll" "$HERE/d2oracle.c" -shared -Wl,--enable-stdcall-fixup
# Extra hook DLLs: every hook/*.dll.c builds to <name>.dll.
for src in "$HERE"/*.dll.c; do
  [ -e "$src" ] || continue
  build "$OUT/$(basename "$src" .dll.c).dll" "$src" -shared -Wl,--enable-stdcall-fixup
done
echo "built: $OUT"
