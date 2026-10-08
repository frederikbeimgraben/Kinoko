#!/usr/bin/env bash
# Put the PMTiles archive into the document root of the homeserver.
#
# No --delete: the root holds the Angular build, the tiles and the manifests.
# rsync writes a temporary file first and then renames it. Thus a client sees
# the old archive or the new archive, never half an archive.
set -euo pipefail
cd "$(dirname "$0")"

ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
SCHLUESSEL=${SCHLUESSEL:-$HOME/.ssh/pilze_deploy}
QUELLE=${QUELLE:-arbeit/deutschland.pmtiles}
URL=${URL:-https://pilze.beimgraben.net/karte/deutschland.pmtiles}

[ -f "$QUELLE" ] || { echo "kein Archiv in $QUELLE, erst: ./bauen.sh"; exit 1; }

echo "lade $QUELLE ($(du -h "$QUELLE" | cut -f1)) nach $ZIEL:karte/"
rsync -a --info=progress2 \
  -e "ssh -i $SCHLUESSEL -o IdentitiesOnly=yes" \
  "$QUELLE" "$ZIEL":karte/

# The app gets the tiles with HTTP range requests. Without 206 the archive is of no use.
echo "Range-Probe:"
curl -sI -r 0-1023 "$URL" | grep -iE '^(HTTP/|content-range|content-length|content-type)'
nix run nixpkgs#pmtiles -- show "$URL"
