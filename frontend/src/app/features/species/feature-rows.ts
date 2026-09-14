import type { Species, Farbe, Farben, Masse, Spanne } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import type { BadgeVariant } from '@stupa-makers/ui-kit';
import { type MeasurementRow } from '../../ui/measurement-group/measurement-group.component';
import { type Extent, type Span } from '../../ui/measurement/measurement.component';
import {
  CHANGE_SPEED_TEXT,
  EDIBILITY_COLOUR,
  EDIBILITY_TEXT,
  MONTH_NAMES,
  PROTECTION_COLOUR,
  PROTECTION_TEXT,
  TRADE_COLOUR,
  UNIT_TEXT,
  YEAR_MARKS,
} from './labels';

/**
 * Die Zeilen einer Art, fertig für die Bausteine aus `ui/`.
 *
 * Sie stehen hier und nicht in der Artseite, weil der Vergleich zweier Arten
 * dieselben Zeilen zeigt. Zweimal gebaut liefen sie auseinander, sobald eine
 * der beiden Seiten etwas anders benennt.
 *
 * Jede Funktion ist rein: sie nimmt die Art und den Übersetzer und gibt eine
 * Ansicht zurück. So lässt sie sich prüfen, ohne eine Seite aufzubauen.
 */

/** Eine Marke, wie das Kit sie zeichnet. */
export interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Eine Karte je Körperteil, darunter jede Strecke als eigene Zeile. */
const MEASURE_GROUPS: readonly {
  schluessel: TranslationKey;
  fields: readonly { field: keyof Masse; extent: Extent }[];
}[] = [
  { schluessel: 'art.mass.hut', fields: [{ field: 'hutBreiteCm', extent: 'width' }] },
  {
    schluessel: 'art.mass.fruchtkoerperHoehe',
    fields: [
      { field: 'fruchtkoerperHoeheCm', extent: 'height' },
      { field: 'fruchtkoerperBreiteCm', extent: 'width' },
    ],
  },
  {
    schluessel: 'art.mass.stielLaenge',
    fields: [
      { field: 'stielLaengeCm', extent: 'height' },
      { field: 'stielDickeCm', extent: 'thickness' },
    ],
  },
  {
    schluessel: 'art.mass.sporenLaenge',
    fields: [
      { field: 'sporenLaengeUm', extent: 'length' },
      { field: 'sporenBreiteUm', extent: 'width' },
    ],
  },
];

/**
 * Die Farbzeilen der Artseite, in der Reihenfolge des Mockups. Das
 * Sporenlager fehlt: seine Farbe steht bei der Fruchtschicht, wo sie hingehört.
 */
const COLOUR_ROWS: readonly { field: keyof Omit<Farben, 'verfaerbung'>; schluessel: TranslationKey }[] = [
  { field: 'hut', schluessel: 'art.farbe.hut' },
  { field: 'stiel', schluessel: 'art.farbe.stiel' },
  { field: 'fleisch', schluessel: 'art.farbe.fleisch' },
  { field: 'sporenpulver', schluessel: 'art.farbe.sporenpulver' },
];

/** Eine Zeile der Einstufung: das Wort und die Farbe, die es einordnet. */
export interface LevelRow {
  schluessel: string;
  pill: { text: string; colour: string };
}

/** Die Karte eines Körperteils: sein Name, darunter seine Strecken. */
export interface MeasureGroup {
  part: string;
  rows: MeasurementRow[];
}

/** Eine Zeile der Farbtafel: das Wort links, die Fläche rechts. */
export interface ColourRow {
  schluessel: string;
  unter: string;
  farben: Farbe[];
  label: string;
}

/** Die Verfärbung: von, Pfeil, nach, Dauer. */
export interface ChangeRow {
  von: Farbe[];
  nach: Farbe[];
  vonLabel: string;
  nachLabel: string;
  dauer: string;
  pfeil: string;
}

/** Die Jahresbahn mit ihrem Satz darüber. */
export interface TimeRow {
  text: string;
  label: string;
  von: number;
  bis: number;
  beobachtetVon: number | null;
  beobachtetBis: number | null;
  marken: string[];
}

/** Geruch oder Geschmack: Kategorien und der Satz daneben. */
export interface SenseRow {
  schluessel: string;
  tags: string[];
  text: string | null;
  label: string;
}

/**
 * Speisewert, Schutz und Handel als drei Plaketten derselben Bauform.
 *
 * Sie standen einmal in zwei Formen untereinander: der Speisewert als Stufe
 * mit Punkt, 14 px und 30 px hoch, Schutz und Handel als Marke ohne Punkt,
 * 12 px und 23 px hoch. Drei Werte derselben Art sahen aus wie drei Dinge.
 *
 * Die Farbe bleibt der einzige Unterschied, weil nur sie etwas sagt: der
 * Speisewert warnt, bevor man das Wort gelesen hat, der Schutz nennt seine
 * Stufe, der Handel ist gedämpft und urteilt nicht.
 */
export function levelRows(i18n: I18nService, art: Species): LevelRow[] {
  const trade = art.marktfaehigkeit.marktfaehig ? 'art.handel.ja' : 'art.handel.nein';
  return [
    {
      schluessel: i18n.translate('art.zeile.speisewert'),
      pill: {
        text: i18n.translate(EDIBILITY_TEXT[art.speisewert]),
        colour: EDIBILITY_COLOUR[art.speisewert],
      },
    },
    {
      schluessel: i18n.translate('art.zeile.schutz'),
      pill: {
        text: i18n.translate(PROTECTION_TEXT[art.schutz.status]),
        colour: PROTECTION_COLOUR[art.schutz.status],
      },
    },
    {
      schluessel: i18n.translate('art.zeile.handel'),
      pill: { text: i18n.translate(trade), colour: TRADE_COLOUR },
    },
  ];
}

/** Die Maße, eine Karte je Körperteil; die seltene Ausnahme als zweite Spanne. */
export function measureGroups(i18n: I18nService, masse: Masse): MeasureGroup[] {
  return MEASURE_GROUPS.flatMap((group) => {
    const rows = group.fields.flatMap((entry) => {
      const span = masse[entry.field];
      if (span === null) return [];
      const spans: Span[] = [{ from: span.von, to: span.bis }];
      const rare = rareSpan(span);
      if (rare) spans.push(rare);
      return [{ extent: entry.extent, spans, unit: i18n.translate(UNIT_TEXT[span.einheit]) }];
    });
    if (rows.length === 0) return [];
    return [{ part: i18n.translate(group.schluessel), rows }];
  });
}

/** Der Ausreißer der Quelle als zweite Spanne, halbseitig offen. */
function rareSpan(span: Spanne): Span | null {
  if (span.seltenBis !== null) return { from: null, to: span.seltenBis };
  if (span.seltenVon !== null) return { from: span.seltenVon, to: null };
  return null;
}

/** Die Farben je Körperteil. Ein Körperteil ohne Farbe steht nicht da. */
export function colourRows(i18n: I18nService, farben: Farben): ColourRow[] {
  return COLOUR_ROWS.flatMap((row) => {
    const colour = colourRow(i18n, row.field, row.schluessel, farben);
    return colour === null ? [] : [colour];
  });
}

/** Eine einzelne Farbzeile, oder nichts, wenn die Quelle keine Farbe nennt. */
export function colourRow(
  i18n: I18nService,
  field: keyof Omit<Farben, 'verfaerbung'>,
  schluessel: TranslationKey,
  farben: Farben,
): ColourRow | null {
  const colours = farben[field];
  if (colours.length === 0) return null;
  const names = colours.map((colour) => colour.name).join(', ');
  return {
    schluessel: i18n.translate(schluessel),
    unter: names,
    farben: colours,
    label: i18n.translate('art.farbe.beschriftung', { farben: names }),
  };
}

/** Ohne Zielfarbe gibt es keine Verfärbung, nur eine Farbe, die bleibt. */
export function changeRow(i18n: I18nService, farben: Farben): ChangeRow | null {
  const change = farben.verfaerbung;
  if (change === null) return null;
  const names = (colours: Farbe[]): string => colours.map((colour) => colour.name).join(', ');
  const label = (colours: Farbe[]): string =>
    i18n.translate('art.farbe.beschriftung', { farben: names(colours) });
  const speed = change.dauer === null ? 'art.verfaerbung.bleibt' : CHANGE_SPEED_TEXT[change.dauer];
  return {
    von: change.von,
    nach: change.nach,
    vonLabel: label(change.von),
    nachLabel: label(change.nach),
    dauer: i18n.translate(change.nach.length === 0 ? 'art.verfaerbung.bleibt' : speed),
    pfeil: i18n.translate('art.verfaerbung.pfeil'),
  };
}

/**
 * Die Jahresbahn: blass der Zeitraum der Quelle, kräftig die Monate, in denen
 * die Kurve mindestens halb so hoch steht wie im Jahresbesten.
 */
export function timeRow(i18n: I18nService, art: Species): TimeRow | null {
  const period = art.zeitraum;
  if (period === null) return null;
  const observed = art.beobachteterZeitraum;
  const month = (number: number): string => i18n.translate(MONTH_NAMES[number - 1]);
  const words = {
    von: month(period.vonMonat),
    bis: month(period.bisMonat),
    vonBeobachtet: observed ? month(observed.vonMonat) : '',
    bisBeobachtet: observed ? month(observed.bisMonat) : '',
  };
  return {
    text: i18n.translate(observed ? 'art.zeit.beobachtet' : 'art.zeit.genannt', words),
    label: i18n.translate(observed ? 'art.zeit.bahnBeobachtet' : 'art.zeit.bahn', words),
    von: period.vonMonat,
    bis: period.bisMonat,
    beobachtetVon: observed?.vonMonat ?? null,
    beobachtetBis: observed?.bisMonat ?? null,
    marken: YEAR_MARKS.map((mark) => i18n.translate(mark)),
  };
}

/** Geruch und Geschmack: die Kategorien tragen den Filter, der Satz den Rest. */
export function senseRows(i18n: I18nService, art: Species): SenseRow[] {
  return [
    { schluessel: 'art.zeile.geruch', sense: art.geruch },
    { schluessel: 'art.zeile.geschmack', sense: art.geschmack },
  ]
    .filter((row) => row.sense.tags.length > 0 || row.sense.text !== null)
    .map((row) => ({
      schluessel: i18n.translate(row.schluessel as TranslationKey),
      tags: row.sense.tags,
      text: row.sense.text,
      label: i18n.translate(row.schluessel as TranslationKey),
    }));
}
