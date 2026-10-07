#!/usr/bin/env bash
# Render src/*.html → out/<name>.png|jpg and src/simple/*.html → out/simple/<name>.png|jpg (3600×2400, 3:2).
# Usage: ./render.sh            (all)   ./render.sh 03-manage   (that name in both sets)
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p out/simple
for f in src/${1:-*}.html src/simple/${1:-*}.html; do
  [ -e "$f" ] || continue
  rel=${f#src/}; dest="out/${rel%.html}"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --window-size=1800,1200 --force-device-scale-factor=2 --virtual-time-budget=4000 \
    --screenshot="$PWD/$dest.png" "file://$PWD/$f" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 90 "$dest.png" --out "$dest.jpg" >/dev/null
  echo "$dest.png"
done
