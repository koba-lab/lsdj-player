#!/bin/bash
# One-time setup on the Mac: builds "LSDj Player.app" and registers it for .lsdprj/.lsdsng.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/LSDj Player.app"
PB=/usr/libexec/PlistBuddy

RP_VER=v0.7.4
RP_ZIP="retroplug-$RP_VER-macos-universal-cli.zip"
RP_SHA=fba48c4c9aa524e71edaf4c19115b2391ec232fa4243934dab8be77d74f50043
CLI="$DIR/bin/retroplug-$RP_VER-macos-universal-cli/retroplug-cli"

command -v python3 >/dev/null || { echo "python3 not found / python3 が見つかりません"; exit 1; }

# 1. retroplug-cli (downloaded from the official release, checksum-verified)
if [ ! -x "$CLI" ]; then
  mkdir -p "$DIR/bin"
  curl -fsSL -o "$DIR/bin/$RP_ZIP" "https://github.com/tommitytom/RetroPlug/releases/download/$RP_VER/$RP_ZIP"
  echo "$RP_SHA  $DIR/bin/$RP_ZIP" | shasum -a 256 -c -
  unzip -o -q "$DIR/bin/$RP_ZIP" -d "$DIR/bin"
  rm -f "$DIR/bin/$RP_ZIP"
fi
chmod +x "$DIR/lsdj-play.sh" "$CLI"
xattr -dr com.apple.quarantine "$DIR/bin" 2>/dev/null || true

# 2. LSDj ROM (not distributed with this repo)
ls "$DIR"/*.gb >/dev/null 2>&1 || echo "NOTE: put your LSDj ROM (*.gb) in $DIR / LSDj の ROM をこのフォルダに置いてください"

rm -rf "$APP"
osacompile -o "$APP" -e "
on open theFiles
  repeat with f in theFiles
    do shell script quoted form of \"$DIR/lsdj-play.sh\" & \" \" & quoted form of POSIX path of f & \" > /dev/null 2>&1 &\"
  end repeat
end open
on run
  display dialog \"Finderで .lsdprj / .lsdsng をダブルクリックすると再生します。\" buttons {\"OK\"}
end run"

P="$APP/Contents/Info.plist"
$PB -c "Set :CFBundleIdentifier com.kobalab.lsdj-player" "$P" 2>/dev/null || $PB -c "Add :CFBundleIdentifier string com.kobalab.lsdj-player" "$P"
$PB -c "Delete :CFBundleDocumentTypes" "$P" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes array" "$P"
$PB -c "Add :CFBundleDocumentTypes:0 dict" "$P"
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeName string LSDj Project" "$P"
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeRole string Viewer" "$P"
$PB -c "Add :CFBundleDocumentTypes:0:LSHandlerRank string Owner" "$P"
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions array" "$P"
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:0 string lsdprj" "$P"
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:1 string lsdsng" "$P"
codesign --force --deep -s - "$APP" 2>/dev/null || true

/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
echo "OK: $APP"
