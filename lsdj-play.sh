#!/bin/bash
# Render an .lsdprj/.lsdsng with LSDj (via retroplug-cli) and play it in QuickTime Player.
# The WAV is written next to the input file as <name>.lsdj-player.<hash>.wav
# and reused when the same song (same bytes) is opened again.
# usage: lsdj-play.sh <song.lsdprj>      env: LSDJ_ROM, LSDJ_MAX (default 3m)
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
IN="$1"
# ROM: $LSDJ_ROM, else the first *.gb in this folder
ROM="${LSDJ_ROM:-$(ls "$DIR"/*.gb 2>/dev/null | head -1)}"
MAX="${LSDJ_MAX:-3m}"
CLI="$DIR/bin/retroplug-v0.7.4-macos-universal-cli/retroplug-cli"
WORK="${TMPDIR:-/tmp}/lsdj-player"
LOG="$WORK/last.log"
LAST="$WORK/last_wav"
OUT="$(cd "$(dirname "$IN")" && pwd)"
mkdir -p "$WORK"

notify() { osascript -e "display notification \"$1\" with title \"LSDj Player\"" >/dev/null 2>&1 || true; }

[ -f "$ROM" ] || { notify "LSDj ROM (*.gb) が見つかりません: $DIR"; exit 1; }

# close the previously opened render in QuickTime (the file itself is kept)
PREV="$(cat "$LAST" 2>/dev/null || true)"
if [ -n "$PREV" ]; then
  osascript >/dev/null 2>&1 <<OSA || true
if application "QuickTime Player" is running then
  tell application "QuickTime Player"
    repeat with d in (get documents)
      try
        if (POSIX path of (file of d as alias)) is "$PREV" then close d saving no
      end try
    end repeat
  end tell
end if
OSA
fi

base="$(basename "$IN")"; base="${base%.*}"
# Cache key = song bytes + ROM bytes + max length. A re-exported .lsdprj with the
# same name but different content gets a new key, so stale audio is never replayed.
KEY="$( { cat "$IN" "$ROM"; echo "$MAX"; } | shasum -a 256 | cut -c1-8 )"
WAV="$OUT/${base}.lsdj-player.${KEY}.wav"

if [ -s "$WAV" ]; then
  echo "== $(date) $IN (cached: $WAV)" >"$LOG"
else
  SAV="$WORK/song.sav"; TMPWAV="$WORK/render.wav"
  start=$(date +%s)
  {
    echo "== $(date) $IN"
    python3 -I "$DIR/lsdprj2sav.py" "$IN" "$SAV" "$ROM" &&
    "$CLI" render "$ROM" --sav "$SAV" --out "$TMPWAV" --max-duration "$MAX"
  } >"$LOG" 2>&1
  rc=$?
  if [ $rc -ne 0 ] || [ ! -s "$TMPWAV" ]; then
    notify "失敗: $base（ログ: $LOG）"
    exit 1
  fi
  mv -f "$TMPWAV" "$WAV"     # only complete renders land in the cache
  echo "total $(( $(date +%s) - start ))s" >>"$LOG"
fi
echo "$WAV" >"$LAST"
grep -q "hff:false" "$LOG" && notify "$base: HFF 無し → ${MAX} で打ち切り"
osascript >/dev/null 2>&1 <<OSA || open -a "QuickTime Player" "$WAV"
tell application "QuickTime Player"
  activate
  set d to open POSIX file "$WAV"
  play d
end tell
OSA
