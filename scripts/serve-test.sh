#!/usr/bin/env bash
# Serves the demo from a temporary copy of the checkout, for testing from a browser on another host.
# Same assembly as .github/workflows/pages.yml: the demo uses ./src/ (this checkout's sources)
# instead of the npm package from jsDelivr. Edit the code, then restart the script to pick up changes.
#
#   scripts/serve-test.sh [port]      # default 8000, listens on all interfaces
set -euo pipefail

PORT="${1:-8000}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="$(mktemp -d)"
trap 'rm -rf "$SITE"' EXIT

cp -r "$ROOT/docs/." "$SITE/"
cp -r "$ROOT/src" "$SITE/src"
cp -r "$ROOT/examples/slides" "$SITE/slides"

CDN='https://cdn.jsdelivr.net/npm/slide-editor@1/src/'
grep -q "$CDN" "$SITE/index.html" || { echo "CDN path not found in docs/index.html" >&2; exit 1; }
sed -i "s#$CDN#./src/#g" "$SITE/index.html"

echo "Serving on http://$(hostname -f 2>/dev/null || hostname):$PORT/  (Ctrl+C to stop)"
cd "$SITE"
python3 -m http.server "$PORT" --bind 0.0.0.0
