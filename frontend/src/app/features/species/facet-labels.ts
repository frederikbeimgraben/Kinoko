import type { FacetKey } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ATTACHMENT_TEXT,
  CAP_FEATURE_TEXT,
  CAP_MARGIN_TEXT,
  CAP_SHAPE_TEXT,
  EDGE_TEXT,
  EDIBILITY_TEXT,
  GEFAEHRDUNG_TEXT,
  HAEUFIGKEIT_TEXT,
  HYMENOPHORE_TEXT,
  PROTECTION_TEXT,
  REAGENZ_TEXT,
  SPACING_TEXT,
  STEM_FEATURE_TEXT,
  TAG_TEXT,
} from './labels';

/**
 * Der Name einer Filtergruppe in der Oberfläche. Als vollständige Zuordnung:
 * fehlt ein Wert, meldet es die Typprüfung und nicht erst eine leere Zeile.
 */
export const FACET_TEXT: Record<FacetKey, TranslationKey> = {
  speisewert: 'filter.gruppe.speisewert',
  schutz: 'filter.gruppe.schutz',
  stufe: 'filter.gruppe.stufe',
  sammelbar: 'filter.gruppe.sammelbar',
  sinne: 'filter.gruppe.sinne',
  farbe: 'filter.gruppe.farbe',
  masse: 'filter.gruppe.masse',
  zeitraum: 'filter.gruppe.zeitraum',
  fruchtschicht: 'filter.gruppe.fruchtschicht',
  stielmerkmale: 'filter.gruppe.stielmerkmale',
  baeume: 'filter.gruppe.baeume',
  wertigkeit: 'filter.gruppe.wertigkeit',
  hutrand: 'filter.gruppe.hutrand',
  haeufigkeit: 'filter.gruppe.haeufigkeit',
  hutform: 'filter.gruppe.hutform',
  hutmerkmale: 'filter.gruppe.hutmerkmale',
  reagenzien: 'filter.gruppe.reagenzien',
  gefaehrdung: 'filter.gruppe.gefaehrdung',
};

/**
 * Gruppen, die diese Oberfläche noch nicht wählen lässt. Die Farbe wartet auf
 * eine gröbere Palette — 52 Farbnamen sind keine Auswahl —, Maße und Zeitraum
 * auf den Vergleich, der eine Überschneidung prüft statt ein Enthaltensein.
 */
export const NOT_YET: readonly FacetKey[] = ['farbe', 'masse', 'zeitraum', 'sinne'];

/**
 * Der Name eines Werts. Die Zuordnungen stehen schon für die Artseite; der
 * Filter nimmt dieselben, damit ein Wert nicht an zwei Stellen zwei Namen hat.
 *
 * Was hier fehlt, steht in `NOT_YET`: Geruch und Geschmack kommen aus dem
 * verwalteten Begriffskatalog, den diese Oberfläche noch nicht liest.
 */
const BY_GROUP: Partial<Record<FacetKey, Readonly<Record<string, TranslationKey>>>> = {
  speisewert: EDIBILITY_TEXT,
  schutz: PROTECTION_TEXT,
  stufe: TAG_TEXT,
  baeume: TAG_TEXT,
  haeufigkeit: HAEUFIGKEIT_TEXT,
  gefaehrdung: GEFAEHRDUNG_TEXT,
  reagenzien: REAGENZ_TEXT,
  hutform: CAP_SHAPE_TEXT,
  hutmerkmale: CAP_FEATURE_TEXT,
  hutrand: CAP_MARGIN_TEXT,
  stielmerkmale: STEM_FEATURE_TEXT,
};

/** Die Fruchtschicht hat vier Teile, jeder mit eigener Zuordnung. */
const BY_PART: Readonly<Record<string, Readonly<Record<string, TranslationKey>>>> = {
  art: HYMENOPHORE_TEXT,
  ansatz: ATTACHMENT_TEXT,
  stand: SPACING_TEXT,
  schneide: EDGE_TEXT,
};

const SWITCH_TEXT: Readonly<Record<string, TranslationKey>> = {
  ja: 'filter.ja',
  nein: 'filter.nein',
};

/**
 * Der Schlüssel zum Namen eines Werts, oder nichts. Ohne Schlüssel zeigt die
 * Oberfläche den Wert selbst — besser als eine leere Zeile, und es fällt auf.
 */
export function valueKey(group: FacetKey, part: string, value: string): TranslationKey | null {
  if (group === 'sammelbar') return SWITCH_TEXT[value] ?? null;
  const table = part ? BY_PART[part] : BY_GROUP[group];
  return table?.[value] ?? null;
}
