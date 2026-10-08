#!/usr/bin/env bash
# Mirror the Angular build into the document root of the homeserver.
#
# The build does not own the root alone. The pipeline writes the tiles, the
# manifests and the layers there. Without the protect filters, --delete would
# remove them. The same filter protects assets/. Old files in it do no harm,
# because Angular does not refer to them.
set -euo pipefail
cd "$(dirname "$0")/.."
ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
SCHLUESSEL=${SCHLUESSEL:-$HOME/.ssh/pilze_deploy}
QUELLE=frontend/dist/pilzkarte/browser/

[ -f "$QUELLE/index.html" ] || { echo "kein Build in $QUELLE, erst: cd frontend && npm run build"; exit 1; }
echo "spiegle Build ($(du -sh "$QUELLE" | cut -f1)) nach $ZIEL"
rsync -av --delete --info=stats2 \
  --filter='P /*/' --filter='P /*.json' \
  -e "ssh -i $SCHLUESSEL -o IdentitiesOnly=yes" \
  "$QUELLE" "$ZIEL":
echo "fertig: https://pilze.beimgraben.net"
