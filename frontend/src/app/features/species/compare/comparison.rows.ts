import type { BodyPart, ColourGroup, SpeciesEntry } from '../../../core/api/models';
import type { I18nService } from '../../../core/i18n/i18n.service';
import type { ColourMode, ColourValue } from '../../../ui/colour-field/colour-field.component';
import { spanText } from '../../../ui/measurement/measurement.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE, SPEED_TEXT } from '../labels';

/** Die Teile mit einer Fruchtschicht, in der Folge des Bretts. */
export const HYMENIUM_PARTS: readonly BodyPart[] = ['tubes', 'gills', 'pores'];

/** Ein Verlauf des Katalogs heißt `distinct`, wo die Fläche hart trennt. */
const MODE: Record<ColourGroup['mode'], ColourMode> = {
  single: 'single',
  gradient: 'gradient',
  distinct: 'multiple',
};

const SEPARATOR = ', ';

/** Die Dauern, die eine Uhr nennt. */
const TIMED: readonly string[] = ['30s', '1min', '3min'];

/** Die Plakette einer Spalte. */
export interface Level {
  text: string;
  colour: string;
  background: string;
}

/** Eine Strecke einer Spalte: Zahl und Einheit stehen getrennt. */
export interface Measure {
  value: string;
  unit: string;
}

/** Eine Farbfläche einer Spalte. */
export interface Swatch {
  colours: readonly ColourValue[];
  mode: ColourMode;
  label: string;
}

/** Die Druckprobe einer Spalte: Von, Nach und die Dauer. */
export interface Pressure {
  from: Swatch | null;
  to: Swatch | null;
  speed: string;
}

/** Die Wachstumszeit einer Spalte. */
export interface Period {
  from: number;
  to: number;
}

export function levelOf(entry: SpeciesEntry, i18n: I18nService): Level {
  return {
    text: i18n.translate(EDIBILITY_TEXT[entry.edibility]),
    ...EDIBILITY_TONE[entry.edibility],
  };
}

export function capWidthOf(entry: SpeciesEntry, i18n: I18nService): Measure | null {
  const group = entry.measurements.find((one) => one.part === 'cap');
  const width = group?.measurements.find((one) => one.dimension === 'width');
  if (!width) return null;
  return {
    value: spanText({ from: width.low, to: width.high }),
    unit: i18n.translate(`enum.unit.${width.unit}` as 'enum.unit.cm'),
  };
}

export function swatchOf(entry: SpeciesEntry, part: BodyPart | null): Swatch | null {
  const group = part === null ? undefined : entry.colours.find((one) => one.part === part);
  if (!group || group.colours.length === 0) return null;
  return {
    colours: group.colours,
    mode: MODE[group.mode],
    label: group.colours.map((one) => one.name).join(SEPARATOR),
  };
}

/** Der Teil, dessen Fruchtschicht die Arten gemeinsam tragen. */
export function hymeniumPartOf(entries: readonly SpeciesEntry[]): BodyPart | null {
  for (const part of HYMENIUM_PARTS) {
    if (entries.some((entry) => entry.colours.some((group) => group.part === part))) return part;
  }
  return null;
}

/** Ohne Verfärbung steht die Farbe der Fruchtschicht allein: an ihr wird gedrückt. */
export function pressureOf(entry: SpeciesEntry, part: BodyPart | null, i18n: I18nService): Pressure | null {
  const change = entry.colourChanges.find((one) => one.kind === 'mechanical');
  if (!change) {
    const base = swatchOf(entry, part);
    return base === null ? null : { from: single(base), to: null, speed: i18n.translate('enum.speed.stays') };
  }
  return {
    from: change.from ? colourSwatch(change.from) : swatchOf(entry, change.part),
    to: colourSwatch(change.to),
    speed: speedOf(change.speed ?? null, i18n),
  };
}

export function stemNetOf(entry: SpeciesEntry): string | null {
  return entry.traits.find((one) => one.key === 'stem')?.text ?? null;
}

export function flavoursOf(entry: SpeciesEntry): readonly string[] | null {
  const tags = entry.terms.filter((one) => one.term.kind === 'taste').map((one) => one.term.name);
  return tags.length === 0 ? null : tags;
}

export function periodOf(entry: SpeciesEntry): Period | null {
  const from = entry.periodStartMonth ?? null;
  const to = entry.periodEndMonth ?? null;
  return from === null || to === null ? null : { from, to };
}

/** Nur eine gemessene Dauer nennt ein Nachher: „nach sofort“ sagt niemand. */
function speedOf(speed: SpeciesEntry['colourChanges'][number]['speed'], i18n: I18nService): string {
  if (!speed) return '';
  const word = i18n.translate(SPEED_TEXT[speed]);
  if (!TIMED.includes(speed)) return word;
  return i18n.translate('species.colourChange.after', { dauer: word });
}

function colourSwatch(colour: ColourValue): Swatch {
  return { colours: [colour], mode: 'single', label: colour.name };
}

function single(swatch: Swatch): Swatch {
  return { ...swatch, mode: 'single' };
}
