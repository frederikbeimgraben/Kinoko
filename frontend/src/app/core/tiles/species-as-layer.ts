import { layerWeek, type Layer, type Histogram } from './layers';
import type { SpeciesManifest } from './manifest';

/**
 * Eine Vorhersage-Art als Eingabe-Ebene.
 *
 * Die Kombination lässt jede Quelle als Faktor zu, auch eine Art. Beide tragen
 * dasselbe: eine Skala mit `low` und `high`, Kachelordner je Woche, eine
 * Liste vorhandener Kacheln und ein Histogramm. Statt zwei Wege durch die
 * halbe Anwendung zu führen, wird die Art hier in die Form der Ebene gebracht:
 * `low` ist 0, `high` der Höchstwert der Art, und ohne Einheit liest sich das
 * als Prozent, was eine Fundwahrscheinlichkeit auch ist.
 */
export function layerFromSpecies(manifest: SpeciesManifest, label: string, note = ''): Layer {
  const histograms = new Map<string, Histogram>();
  for (const week of manifest.weeks) {
    if (week.histogram) histograms.set(layerWeek(week.year, week.week), week.histogram);
  }
  return {
    id: manifest.slug,
    label,
    title: label,
    note,
    range: '',
    unit: '',
    fixed: false,
    low: 0,
    high: manifest.top,
    tilePath: tileRoot(manifest),
    zoomFrom: manifest.zoomFrom,
    zoomTo: manifest.zoomTo,
    existing: manifest.existing,
    weeks: manifest.weeks.map((week) => layerWeek(week.year, week.week)),
    histogram: null,
    histograms,
  };
}

/**
 * Der Ordner über den Wochen. Er wird aus dem Pfad der ersten Woche gelesen
 * und nicht aus dem Slug gebaut: dann trifft ein Umbenennen im Rendering nur
 * das Manifest.
 */
function tileRoot(manifest: SpeciesManifest): string {
  const first = manifest.weeks.at(0)?.tilePath ?? '';
  const cut = first.lastIndexOf('/');
  return cut > 0 ? first.slice(0, cut) : first;
}
