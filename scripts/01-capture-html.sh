#!/usr/bin/env bash
# Capture the production HTML of every aurorashouse.webflow.io page into _capture/pages/.
# This is the "production truth" layer — treated as read-only reference.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p _capture/pages

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
BASE="https://aurorashouse.webflow.io"

ROUTES=( / /aboutme /form /caterpilla-com /generation /guccifunfair /gucciquest /hoj /jellyfied /kiri /mars /mothers /oca /regen /rossco /uptime )

echo "===== Downloading ${#ROUTES[@]} HTML pages ====="
for r in "${ROUTES[@]}"; do
  if [ "$r" = "/" ]; then name="index"; else name="${r#/}"; fi
  code=$(curl -sL -A "$UA" "$BASE$r" -o "_capture/pages/$name.html" -w "%{http_code}")
  size=$(wc -c < "_capture/pages/$name.html" | tr -d ' ')
  printf "  %-16s HTTP %s  %7s bytes\n" "$r" "$code" "$size"
  sleep 0.3
done

echo
echo "===== Page inventory ====="
ls -la _capture/pages/
