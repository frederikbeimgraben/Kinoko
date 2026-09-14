/** Beispielwerte der Werkstattseite: Zahlen und lateinische Namen ohne eigenen Textschlüssel. */
import type { Farbe, Licence, SpeciesImage } from '../../core/api/models';
import type { Span, TimelineWeek } from '../../ui';

/** Die acht Wochen des Artboards. Die Jahresmarke fällt auf KW 41. */
export const SAMPLE_WEEKS: readonly TimelineWeek[] = [
  { year: 2025, week: 38, share: 0.7, forecast: false },
  { year: 2025, week: 39, share: 0.88, forecast: false },
  { year: 2025, week: 40, share: 1, forecast: false },
  { year: 2026, week: 41, share: 0.76, forecast: true },
  { year: 2026, week: 42, share: 0.4, forecast: true },
  { year: 2026, week: 43, share: 0.2, forecast: true },
  { year: 2026, week: 44, share: 0.08, forecast: true },
  { year: 2026, week: 45, share: 0.04, forecast: true },
];

/** Die Saisonkurve als Glocke um die Spitzenwoche. */
function seasonValue(week: number, peak: number, offset: number, factor: number): number {
  const position = week - peak - offset;
  return (
    factor *
    (Math.exp(-(position * position) / 26) + 0.25 * Math.exp(-((position + 6) * (position + 6)) / 40))
  );
}

export const SAMPLE_ALL_YEARS: readonly number[] = Array.from({ length: 52 }, (_, i) =>
  seasonValue(i + 1, 40, 0, 1),
);

export const SAMPLE_CURRENT_YEAR: readonly number[] = Array.from({ length: 39 }, (_, i) =>
  seasonValue(i + 1, 40, -1.5, 1.1),
);

/** Die 40 Klassen des Histogramms. */
export const SAMPLE_HISTOGRAM: readonly number[] = Array.from({ length: 40 }, (_, i) => {
  const one = i - 14;
  const two = i - 30;
  return Math.exp(-(one * one) / 90) + 0.35 * Math.exp(-(two * two) / 60);
});

/** Vier lateinische Artnamen für Zeilen, die kein Schlüssel deckt. */
export const LATIN_NAMES: readonly string[] = [
  'Boletus edulis',
  'Cantharellus cibarius',
  'Leccinum scabrum',
  'Amanita muscaria',
];

/** Zwei Gattungen als Beispiel für eine Marke ohne Interaktion. */
export const TREE_GENERA: readonly string[] = ['Fagus', 'Quercus', 'Picea', 'Pinus'];

/** Farbfelder mit lateinischen Kennwörtern statt einem deutschen Farbnamen. */
export const CAP_COLOURS: readonly Farbe[] = [
  { name: 'fulvus', hex: '#c8a25a' },
  { name: 'badius', hex: '#6b4423' },
];
export const FLESH_COLOURS: readonly Farbe[] = [{ name: 'candidus', hex: '#f4efe2' }];
export const BRUISE_COLOURS: readonly Farbe[] = [{ name: 'caeruleus', hex: '#3f6ea8' }];
export const GRADIENT_COLOURS: readonly Farbe[] = [
  { name: 'candidus', hex: '#f4efe2' },
  { name: 'fulvus', hex: '#c8a25a' },
  { name: 'badius', hex: '#6b4423' },
];
export const MULTI_COLOURS: readonly Farbe[] = [
  { name: 'candidus', hex: '#f4efe2' },
  { name: 'olivaceus', hex: '#6f7d3c' },
];

/** Zwei Spannen: die übliche Breite, darunter die seltene Ausnahme. */
export const CAP_WIDTH_SPANS: readonly Span[] = [{ from: 4, to: 20 }];
export const SPORE_LENGTH_SPANS: readonly Span[] = [
  { from: 12.4, to: 19.2 },
  { from: 4.5, to: 5.5 },
];

const LICENCE: Licence = 'cc-by-sa-4';

/** Ein Bild für Kachel, Herkunftszeile, großen Betrachter und geladenes Bild. */
export const SAMPLE_IMAGE: SpeciesImage = {
  id: 'bild-eins',
  speciesSlug: 'boletus-edulis',
  photographer: 'Marie Weber',
  licence: LICENCE,
  source: null,
  takenOn: '2026-09-06',
  caption: null,
  lat: null,
  lon: null,
  lead: true,
  width: 1600,
  height: 1200,
  url: '/api/species-images/bild-eins/full',
  thumbUrl: '/api/species-images/bild-eins/thumb',
};
