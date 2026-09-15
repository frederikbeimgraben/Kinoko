#!/usr/bin/env bash
# Deutschlandweit, nur Wertkacheln. Vollbilder waeren 1,4 GB, die niemand
# laedt: ein Bild wiegt 1,4 MB, ein Kachelblick 90 bis 300 kB.
set -u
cd "$(dirname "$0")"
# Der Katalog geht einmal je Lauf raus, nicht je Art.
PILZE_KATALOG=$(python -u src/pilze/species_slug.py --fetch) || exit 1
export PILZE_KATALOG
karte () {
  SLUG=$1; TAXA=$2; LABEL=$3; WALD=${4:-0.03}
  # NUR="a b c" beschraenkt den Lauf auf diese Arten.
  if [ -n "${NUR:-}" ] && ! echo " $NUR " | grep -q " $SLUG "; then return; fi
  # Der Katalogslug heisst die Ausgabe, der Kettenname bleibt intern.
  ART=$(python -u src/pilze/species_slug.py --match "$TAXA") \
    || { echo "übersprungen: $TAXA ohne Katalogtreffer"; return; }
  if [ "${NEU:-0}" != "1" ] && [ -d "reports/maps/${ART}_kacheln" ]; then
    echo "--- $LABEL steht schon, uebersprungen ---"; return
  fi
  echo "=========== $LABEL ($SLUG) $(date +%H:%M:%S) ==========="
  python -u src/pilze/region_map.py --model "models/${SLUG}.pkl" --name "$ART" \
      --region de --weeks 90 --forecast 2 --step 500 --min-forest "$WALD" \
      --tiles --no-image 2>&1 | grep -E "^(wrote|  Kacheln|  ausgespart)"
  [ -f "reports/maps/${ART}.json" ] || echo "FEHLER: keine Karte fuer $SLUG"
}
karte boletus_edulis "Boletus edulis" "Steinpilz"
karte pfifferling    "Cantharellus cibarius" "Pfifferling"
karte birkenpilz     "Leccinum scabrum" "Birkenpilz"
karte reizker        "Lactarius deliciosus,Lactarius deterrimus,Lactarius salmonicolor,Lactarius semisanguifluus" "Reizker"
karte hexen_flock    "Neoboletus erythropus" "Flockenstieliger Hexenroehrling"
karte hexen_netz     "Suillellus luridus" "Netzstieliger Hexenroehrling"
karte parasol        "Macrolepiota procera" "Parasol"
karte nebelkappe     "Clitocybe nebularis" "Nebelkappe"
karte flaschenbovist "Lycoperdon perlatum" "Flaschenbovist"
karte schleimruebling "Mucidula mucida" "Buchen-Schleimruebling"
karte schopftintling "Coprinus comatus" "Schopftintling" 0.0
echo "=========== FERTIG $(date -Is) ==========="
