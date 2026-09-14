import type { Species } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { UNIT_TEXT } from './labels';
import { changeRow, colourRow, levelRows, senseRows, timeRow } from './feature-rows';

/** Die Gegenüberstellung mehrerer Arten, je Zeile ein Wort statt eines Bausteins. */

/** Eine Zeile: die Beschriftung und je Art ein Wert. */
export interface ComparisonRow {
  key: string;
  label: string;
  values: readonly string[];
}

function level(i18n: I18nService, art: Species): string {
  return levelRows(i18n, art)[0].pill.text;
}

function capWidth(i18n: I18nService, art: Species): string {
  const span = art.masse.hutBreiteCm;
  if (span === null) return '';
  const from = span.von;
  const to = span.bis;
  return `${from}–${to} ${i18n.translate(UNIT_TEXT[span.einheit])}`;
}

function colour(i18n: I18nService, art: Species, field: 'hut' | 'sporenlager'): string {
  const schluessel = field === 'hut' ? 'art.farbe.hut' : 'art.farbe.sporenlager';
  const row = colourRow(i18n, field, schluessel, art.farben);
  return row?.unter ?? '';
}

function change(i18n: I18nService, art: Species): string {
  const row = changeRow(i18n, art.farben);
  return row === null ? '' : `${row.vonLabel} ${row.pfeil} ${row.nachLabel}`;
}

function feature(art: Species, key: 'stiel'): string {
  return art.merkmale.find((entry) => entry.schluessel === key)?.text ?? '';
}

function flavour(i18n: I18nService, art: Species): string {
  const label = i18n.translate('art.zeile.geschmack');
  const row = senseRows(i18n, art).find((entry) => entry.schluessel === label);
  if (!row) return '';
  return row.tags.length > 0 ? row.tags.join(', ') : (row.text ?? '');
}

function period(i18n: I18nService, art: Species): string {
  return timeRow(i18n, art)?.text ?? '';
}

/** Die acht Zeilen des Vergleichs, in der Reihenfolge des Artboards. */
const ROWS: readonly {
  key: string;
  label: TranslationKey;
  take: (i18n: I18nService, art: Species) => string;
}[] = [
  { key: 'speisewert', label: 'art.zeile.speisewert', take: level },
  { key: 'hutbreite', label: 'art.mass.hut', take: capWidth },
  { key: 'hutfarbe', label: 'art.farbe.hut', take: (i18n, art) => colour(i18n, art, 'hut') },
  {
    key: 'sporenlager',
    label: 'art.farbe.sporenlager',
    take: (i18n, art) => colour(i18n, art, 'sporenlager'),
  },
  { key: 'verfaerbung', label: 'art.verfaerbung.zeile', take: change },
  { key: 'stiel', label: 'art.merkmal.stiel', take: (_i18n, art) => feature(art, 'stiel') },
  { key: 'geschmack', label: 'art.zeile.geschmack', take: flavour },
  { key: 'zeit', label: 'art.zeile.wachstum', take: period },
];

/**
 * Die Gegenüberstellung mehrerer Arten.
 *
 * Eine Zeile, die keine der Arten füllt, fällt weg: eine leere Zeile über die
 * ganze Breite sagt nichts und kostet einen Blick.
 */
export function comparisonRows(i18n: I18nService, species: readonly Species[]): ComparisonRow[] {
  return ROWS.flatMap((row) => {
    const values = species.map((art) => row.take(i18n, art));
    if (values.every((value) => value === '')) return [];
    return [{ key: row.key, label: i18n.translate(row.label), values }];
  });
}
