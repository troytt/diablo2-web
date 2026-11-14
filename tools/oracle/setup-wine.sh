#!/usr/bin/env bash
# Rootless oracle toolchain: Wine 10 (experimental WoW64) + i686 mingw-w64,
# extracted from the distro apt repository into $D2_ORACLE_ROOT (no sudo).
#
# Usage: tools/oracle/setup-wine.sh
#   D2_ORACLE_ROOT  install root (default: $HOME/.local/opt/d2oracle)
#   D2_DATA_DIR     original 1.13c install dir (default: <repo>/samples/d2)
#
# Layout produced:
#   $D2_ORACLE_ROOT/wine/root     extracted wine packages
#   $D2_ORACLE_ROOT/wine/prefix   WINEPREFIX (drive_c/D2 = private copy of D2)
#   $D2_ORACLE_ROOT/mingw         extracted i686-w64-mingw32 gcc/binutils
set -euo pipefail

REPO=$(cd "$(dirname "$0")/../.." && pwd)
ROOT=${D2_ORACLE_ROOT:-$HOME/.local/opt/d2oracle}
D2=${D2_DATA_DIR:-$REPO/samples/d2}

[ -f "$D2/Game.exe" ] || { echo "Game.exe not found in $D2" >&2; exit 1; }

mkdir -p "$ROOT/debs" "$ROOT/wine/root" "$ROOT/mingw"
cd "$ROOT/debs"

WINE_PKGS="wine wine64 libwine wine-common fonts-wine libz-mingw-w64"
MINGW_PKGS="gcc-mingw-w64-i686-win32 binutils-mingw-w64-i686 mingw-w64-i686-dev \
  gcc-mingw-w64-i686-win32-runtime gcc-mingw-w64-base mingw-w64-common"

# shellcheck disable=SC2086
apt-get download $WINE_PKGS $MINGW_PKGS
for p in $WINE_PKGS; do dpkg -x "$(ls ${p}_*.deb | head -1)" "$ROOT/wine/root"; done
for p in $MINGW_PKGS; do dpkg -x "$(ls ${p}_*.deb | head -1)" "$ROOT/mingw"; done

R=$ROOT/wine/root
W=$R/usr/lib/x86_64-linux-gnu/wine
# The relocated wineserver resolves NLS files at <datadir>/wine/nls.
ln -sfn . "$R/usr/share/wine/wine"

# Debian ships zlib1.dll separately (libz-mingw-w64); user32 imports it.
cp "$R/usr/x86_64-w64-mingw32/lib/zlib1.dll" "$W/x86_64-windows/"
cp "$R/usr/i686-w64-mingw32/lib/zlib1.dll" "$W/i386-windows/"

export WINEPREFIX=$ROOT/wine/prefix WINESERVER=$W/wineserver WINELOADER=$W/wine
export WINEDEBUG=-all WINEDLLOVERRIDES="mscoree,mshtml="
xvfb-run -a "$W/wine" wineboot -i || true
"$W/wineserver" -w

# ...and the prefix copies are what the WoW64 loader actually resolves.
cp "$R/usr/i686-w64-mingw32/lib/zlib1.dll" "$WINEPREFIX/drive_c/windows/syswow64/"
cp "$R/usr/x86_64-w64-mingw32/lib/zlib1.dll" "$WINEPREFIX/drive_c/windows/system32/"

# Without the winxp version, Fog.dll recurses into a stack overflow during
# startup (observed at Fog+0x1879B under WoW64).
"$W/wine" reg add 'HKCU\Software\Wine' /v Version /d winxp /f
"$W/wineserver" -w

# Private copy so the game can write saves/logs without touching $D2.
mkdir -p "$WINEPREFIX/drive_c/D2"
for f in "$D2"/*; do
  case "$(basename "$f")" in
    *.mpq|*.MPQ) ln -sf "$(realpath "$f")" "$WINEPREFIX/drive_c/D2/" ;;
    *) cp -r "$f" "$WINEPREFIX/drive_c/D2/" ;;
  esac
done

# Python helpers (menu driver: python-xlib; RE helpers: capstone/pefile).
python3 -m venv "$ROOT/venv"
"$ROOT/venv/bin/pip" install -q python-xlib capstone pefile

echo "oracle toolchain ready under $ROOT"
