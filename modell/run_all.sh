#!/usr/bin/env bash
# One series per species. final_model.py builds one model per horizon in one
# run. region_map.py picks the horizon of each week from its distance to the
# last week with weather.
# Logs go to reports/rebuild/<slug>.*.log, so a failed step can be read.
set -u
cd "$(dirname "$0")"
LOGS=${LOGS:-reports/rebuild}; mkdir -p "$LOGS"
# Der Katalog geht einmal je Lauf raus, nicht je Art.
if [ -z "${LISTE:-}" ]; then
  PILZE_KATALOG=$(python -u src/pilze/species_slug.py --fetch) || exit 1
  export PILZE_KATALOG
fi
run () {
  SLUG=$1; TAXA=$2; LABEL=$3; WALD=${4:-0.03}
  # LISTE=1 druckt nur Slug und Taxa, damit der Arbeiter die Arten kennt.
  if [ -n "${LISTE:-}" ]; then printf '%s\t%s\n' "$SLUG" "$TAXA"; return; fi
  # NUR="a b c" beschraenkt den Lauf auf diese Arten, etwa fuer zwei
  # Instanzen nebeneinander: jede rechnet mit acht Faeden.
  if [ -n "${NUR:-}" ] && ! echo " $NUR " | grep -q " $SLUG "; then return; fi
  # Der Katalogslug heisst die Ausgabe, der Kettenname bleibt intern.
  ART=$(python -u src/pilze/species_slug.py --match "$TAXA") \
    || { echo "übersprungen: $TAXA ohne Katalogtreffer"; return; }
  echo "=========== $LABEL ($SLUG) $(date +%H:%M:%S) ==========="
  # Fertige Arten ueberspringen, ausser NEU=1 erzwingt alles.
  if [ "${NEU:-0}" != "1" ] && [ -f "reports/maps/${ART}.json" ] \
     && [ -f "models/${SLUG}.pkl" ]; then
    echo "--- $LABEL steht schon, uebersprungen ---"
    return
  fi
  if [ "${NEU:-0}" = "1" ] || [ ! -f "data/processed/visits_${SLUG}.parquet" ]; then
    python -u src/pilze/visit_model.py --species "$TAXA" --min-species 2 --quick \
        --save-prepared "data/processed/visits_${SLUG}.parquet" \
        2>&1 | tee "$LOGS/$SLUG.visits.log" | grep -E "^visits with weather" | head -1 || return
  fi
  python -u src/pilze/final_model.py --data "data/processed/visits_${SLUG}.parquet" \
      --name "$SLUG" --species "$TAXA" \
      2>&1 | tee "$LOGS/$SLUG.model.log" | grep -E "^(=====|chosen|calibration ceiling|Brier)"
  [ -f "models/${SLUG}.pkl" ] || { echo "FEHLER: kein Modell fuer $SLUG"; tail -5 "$LOGS/$SLUG.model.log"; return; }
  python -u src/pilze/region_map.py --model "models/${SLUG}.pkl" --name "$ART" \
      --region de --weeks 90 --step 500 --min-forest "${WALD:-0.03}" \
      --tiles --no-image 2>&1 | tee "$LOGS/$SLUG.map.log" | grep -E "^(wrote|  Kacheln)"
  [ -f "reports/maps/${ART}.json" ] || { echo "FEHLER: keine Karte fuer $SLUG"; tail -5 "$LOGS/$SLUG.map.log"; return; }
  python -u src/pilze/build_page.py > /dev/null 2>&1 || true
  echo "--- $LABEL live ---"
}
run boletus_edulis "Boletus edulis" "Steinpilz"
run pfifferling "Cantharellus cibarius" "Pfifferling"
run birkenpilz  "Leccinum scabrum" "Birkenpilz"
run reizker     "Lactarius deliciosus,Lactarius deterrimus,Lactarius salmonicolor,Lactarius semisanguifluus" "Reizker"
run hexen_flock "Neoboletus erythropus" "Flockenstieliger Hexenroehrling"
run hexen_netz  "Suillellus luridus" "Netzstieliger Hexenroehrling"
run parasol        "Macrolepiota procera" "Parasol"
run nebelkappe     "Clitocybe nebularis" "Nebelkappe"
run flaschenbovist "Lycoperdon perlatum" "Flaschenbovist"
run schleimruebling "Mucidula mucida" "Buchen-Schleimruebling"
# Der Schopftintling waechst an Wegraendern und auf Wiesen, nicht im Wald.
# Die Waldmaske von 3 Prozent wuerde ihn dort ausblenden, wo er steht.
run schopftintling "Coprinus comatus" "Schopftintling" 0.0
if [ -z "${LISTE:-}" ]; then
  python -u src/pilze/build_page.py
  echo "=========== ALL REBUILT $(date -Is) ==========="
fi
