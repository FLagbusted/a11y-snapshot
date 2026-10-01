#!/usr/bin/env bash
# Usage: ./run.sh                 -> scans prospects.csv
#        ./run.sh prospects-eu.csv -> scans another list
# Installs deps once, scans every store in the CSV, zips results next to this folder.
set -euo pipefail
cd "$(dirname "$0")"
LIST="${1:-prospects.csv}"
command -v node >/dev/null || { echo "Node.js 18+ is required: https://nodejs.org"; exit 1; }
[ -d node_modules/playwright ] || npm install --no-fund --no-audit
npx playwright install chromium >/dev/null
NAME="$(basename "$LIST" .csv)"
OUT_DIR="reports-$NAME" node scan.js --file "$LIST"
rm -f "../a11y-results-$NAME.zip"
zip -rq "../a11y-results-$NAME.zip" "reports-$NAME"
echo
echo "Upload this file back to Claude: $(cd .. && pwd)/a11y-results-$NAME.zip"
