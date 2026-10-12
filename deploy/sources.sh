#!/usr/bin/env bash
# Downloads the four raw data sources that an admin uploads once and packs
# each one in the form that Verwaltung → Datenquellen accepts.
#
#   deploy/sources.sh <folder>                 all four sources
#   deploy/sources.sh <folder> outline dem     only the named sources
#
# The sources, in the upload order of docs/operations.md:
#   outline  → germany-outline.geojson  (Umriss Deutschland, BKG through geoBoundaries, dl-de/by-2-0)
#   trees    → tree-species-map.zip     (Baumartenkarte, Thünen WCS, CC BY 4.0)
#   dem      → dem.zip                  (Höhenmodell, Copernicus GLO-90 from the AWS open-data bucket)
#   soil     → soilgrids.zip            (SoilGrids-Böden, ISRIC WCS, CC BY 4.0)
#
# The tree map is about 5.5 GB of raw pixels. The Thünen WCS does not give it
# in one request, so the script asks for tiles of 50 km, four at a time. A
# tile that is already in <folder>/work is not asked for again, so a stopped
# run continues. Expect one to three hours for the tree map; the other
# sources take minutes.
#
# Exit code: 0 when each file is ready, 1 when a download fails, 2 for a usage error.
# Tools: bash, curl, zip, xargs.
set -euo pipefail

usage() {
  echo "usage: $0 <folder> [outline] [trees] [dem] [soil]" >&2
  exit 2
}

[ $# -ge 1 ] || usage
OUT=$1
shift
WANT=${*:-outline trees dem soil}
for name in $WANT; do
  case $name in
    outline | trees | dem | soil) ;;
    *) usage ;;
  esac
done
for tool in curl zip xargs; do
  command -v "$tool" >/dev/null || {
    echo "missing tool: $tool" >&2
    exit 2
  }
done
mkdir -p "$OUT/work"
OUT=$(cd "$OUT" && pwd)
WORK=$OUT/work

# get <url> <file>: downloads to a temporary file first, with retries.
get() {
  curl -fsSL --retry 4 --retry-delay 10 --connect-timeout 30 -o "$2.part" "$1" && mv "$2.part" "$2"
}

# tiff <file>: a WCS error comes as XML with status 200, so check the magic bytes.
tiff() {
  case $(head -c 4 "$1" | od -An -tx1 | tr -d ' \n') in
    49492a00 | 4d4d002a | 49492b00 | 4d4d002b) return 0 ;;
    *) return 1 ;;
  esac
}

outline() {
  echo "== germany-outline"
  get "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/DEU/ADM0/geoBoundaries-DEU-ADM0.geojson" \
    "$OUT/germany-outline.geojson"
  echo "   $OUT/germany-outline.geojson"
}

# One tile of the tree map: <east> <north> of the lower left corner in EPSG:32632.
tree_tile() {
  local e=$1 n=$2 file="$WORK/trees/tile_${1}_${2}.tif"
  [ -s "$file" ] && return 0
  get "https://atlas.thuenen.de/geoserver/ows?service=WCS&version=2.0.1&request=GetCoverage&coverageId=geonode__Dominant_Species_Class&format=image/tiff&subset=E($e,$((e + 50000)))&subset=N($n,$((n + 50000)))" "$file.tmp"
  if ! tiff "$file.tmp"; then
    echo "   tile $e $n: the server sent no GeoTIFF: $(head -c 300 "$file.tmp")" >&2
    rm -f "$file.tmp"
    return 1
  fi
  mv "$file.tmp" "$file"
  echo "   tile $e $n"
}

trees() {
  echo "== tree-species-map (tiles of 50 km, resumable)"
  mkdir -p "$WORK/trees"
  export -f get tiff tree_tile
  export WORK
  # The extent of the coverage: E 280460 to 921220, N 5236910 to 6098380.
  for e in $(seq 280000 50000 920000); do
    for n in $(seq 5200000 50000 6050000); do echo "$e $n"; done
  done | xargs -P 4 -n 2 bash -c 'tree_tile "$0" "$1"'
  rm -f "$OUT/tree-species-map.zip"
  (cd "$WORK/trees" && zip -q -9 "$OUT/tree-species-map.zip" tile_*.tif)
  echo "   $OUT/tree-species-map.zip"
}

dem() {
  echo "== dem (Copernicus GLO-90 tiles N47 to N55, E005 to E015)"
  mkdir -p "$WORK/dem"
  get "https://copernicus-dem-90m.s3.amazonaws.com/tileList.txt" "$WORK/dem/tileList.crlf"
  # The list has CRLF line ends.
  tr -d '\r' <"$WORK/dem/tileList.crlf" >"$WORK/dem/tileList.txt"
  local lat lon name
  for lat in 47 48 49 50 51 52 53 54 55; do
    for lon in 005 006 007 008 009 010 011 012 013 014 015; do
      name="Copernicus_DSM_COG_30_N${lat}_00_E${lon}_00_DEM"
      grep -qx "$name" "$WORK/dem/tileList.txt" || continue
      [ -s "$WORK/dem/$name.tif" ] || get "https://copernicus-dem-90m.s3.amazonaws.com/$name/$name.tif" "$WORK/dem/$name.tif"
    done
  done
  rm -f "$OUT/dem.zip"
  # The tiles are compressed GeoTIFFs already, so store them.
  (cd "$WORK/dem" && zip -q -0 "$OUT/dem.zip" Copernicus_*.tif)
  echo "   $OUT/dem.zip ($(ls "$WORK/dem"/Copernicus_*.tif | wc -l) tiles)"
}

soil() {
  echo "== soilgrids (0 to 5 cm, EPSG:4326)"
  mkdir -p "$WORK/soil"
  local prop file
  for prop in phh2o sand soc clay silt; do
    file="$WORK/soil/${prop}_0-5cm_mean.tif"
    [ -s "$file" ] && continue
    get "https://maps.isric.org/mapserv?map=/map/$prop.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=${prop}_0-5cm_mean&FORMAT=image/tiff&SUBSET=long(5.5,15.5)&SUBSET=lat(47,55.5)&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326" "$file"
    tiff "$file" || {
      echo "   $prop: the server sent no GeoTIFF: $(head -c 300 "$file")" >&2
      rm -f "$file"
      return 1
    }
    echo "   $prop"
  done
  rm -f "$OUT/soilgrids.zip"
  (cd "$WORK/soil" && zip -q -0 "$OUT/soilgrids.zip" *_0-5cm_mean.tif)
  echo "   $OUT/soilgrids.zip"
}

for name in $WANT; do
  "$name"
done
echo "Upload in this order: germany-outline, tree-species-map, dem, soilgrids."
