#!/usr/bin/env bash
# Build d2host-113c.exe with the rootless i686 mingw toolchain.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}
CC=${CC:-$ROOT/mingw/usr/bin/i686-w64-mingw32-gcc-win32}
OUT=${1:-$ROOT/build}
mkdir -p "$OUT"
CFLAGS="-O2 -Wall -Wextra -Wno-unused-parameter -static-libgcc"

out="$OUT/d2host-113c.exe"
src="$HERE/d2host-113c.c"
src_hash=$(sha256sum "$src" | cut -d' ' -f1)
old_hash=$(cat "$out.sha256" 2>/dev/null || true)
if [ ! -f "$out" ] || [ "$src" -nt "$out" ] || [ "$src_hash" != "$old_hash" ]; then
  tmp=$(mktemp "$OUT/.build.XXXXXX")
  $CC $CFLAGS -o "$tmp" "$src" -Wl,--enable-stdcall-fixup
  mv -f "$tmp" "$out"
  printf '%s\n' "$src_hash" > "$out.sha256"
fi
echo "built: $out"
