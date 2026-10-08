#!/usr/bin/env bash
# Build the PMTiles archive of Germany.
#
# The arguments below are those of OpenFreeMap (tilegen/tilegen_lib/planetiler.py),
# but with --area=germany in place of planet. Thus the tiles have the same
# fields as the online map, and the styles "liberty" and "dark" work offline
# without a change.
#
# Two differences keep the archive below 3 GB. No pixel changes:
#
# --languages: only de and en, not the 84 languages of OpenFreeMap. The styles
# read only name:latin and name:nonlatin for the labels. The app uses de and en.
#
# --exclude-ids: the tiles have no feature IDs. Only a map that sets
# feature-state needs them. The base map only draws.
#
# Measured for Germany, zoom 14: 3.25 GB with all languages, 3.12 GB with
# de and en, 2.86 GB also without IDs.
set -euo pipefail

PLANETILER_VERSION=${PLANETILER_VERSION:-v0.10.2}
PLANETILER_SHA256=${PLANETILER_SHA256:-f310bd0413e2e4512b27f4046d418664e8e1d3bf31603c2a70e23de06c167e4d}

HIER=$(cd "$(dirname "$0")" && pwd)
ARBEIT=${ARBEIT:-$HIER/arbeit}
ZIEL=${ZIEL:-$ARBEIT/deutschland.pmtiles}
GEBIET=${GEBIET:-germany}
SPEICHER=${SPEICHER:-8g}

JAR=$ARBEIT/planetiler-$PLANETILER_VERSION.jar
mkdir -p "$ARBEIT"

if [ ! -f "$JAR" ]; then
  echo "lade planetiler $PLANETILER_VERSION"
  curl -fsSL -o "$JAR.teil" \
    "https://github.com/onthegomap/planetiler/releases/download/$PLANETILER_VERSION/planetiler.jar"
  mv "$JAR.teil" "$JAR"
fi
echo "$PLANETILER_SHA256  $JAR" | sha256sum -c - >/dev/null

# The run puts the sources and the intermediate files in the work folder, not
# in the current folder. The sources stay, so a second run does not download
# the 5 GB of the OSM extract again.
cd "$ARBEIT"
zeit_start=$(date +%s)
nix run nixpkgs#jdk21 -- \
  "-Xmx$SPEICHER" -jar "$JAR" \
  "--area=$GEBIET" \
  --download \
  --download-threads=10 \
  --download-chunk-size-mb=1000 \
  --fetch-wikidata \
  "--output=$ZIEL" \
  --storage=mmap \
  --nodemap-type=sparsearray \
  --force \
  --languages=de,en \
  --exclude-ids \
  --transliterate=false
zeit_ende=$(date +%s)

nix run nixpkgs#pmtiles -- verify "$ZIEL"
echo "fertig: $ZIEL, $(du -h "$ZIEL" | cut -f1), $(( (zeit_ende - zeit_start) / 60 )) min"
echo "weiter mit: $HIER/hochladen.sh"
