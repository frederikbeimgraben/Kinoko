import type { BodyPart, SpeciesEntry, StandardColour } from '../../core/api/models';

const GAMMA_CUT = 0.04045;
const CUBE_ROOT = 1 / 3;
const WEIGHTS: readonly [number, number, number] = [1, 2, 2];

function channels(value: string): [number, number, number] {
  const raw = value.replace('#', '');
  return [0, 2, 4].map((at) => parseInt(raw.slice(at, at + 2), 16) / 255) as [number, number, number];
}

function linear(value: number): number {
  return value <= GAMMA_CUT ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Rechnet eine Farbe in den Oklab-Raum. */
export function oklab(value: string): [number, number, number] {
  const [red, green, blue] = channels(value).map(linear);
  const long = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const medium = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const short = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const [one, two, three] = [long, medium, short].map((part) => part ** CUBE_ROOT);
  return [
    0.2104542553 * one + 0.793617785 * two - 0.0040720468 * three,
    1.9779984951 * one - 2.428592205 * two + 0.4505937099 * three,
    0.0259040371 * one + 0.7827717662 * two - 0.808675766 * three,
  ];
}

/** Der Abstand zweier Farben im Oklab-Raum, Buntheit doppelt gewichtet. */
export function distance(first: string, second: string): number {
  const left = oklab(first);
  const right = oklab(second);
  return Math.sqrt(left.reduce((sum, part, at) => sum + ((part - right[at]) * WEIGHTS[at]) ** 2, 0));
}

/** Die nächste Standardfarbe des Bündels zu einer Katalogfarbe. */
export function nearestColour(value: string, palette: readonly StandardColour[]): StandardColour | null {
  let best: StandardColour | null = null;
  let shortest = Number.POSITIVE_INFINITY;
  for (const colour of palette) {
    const span = distance(value, colour.hex);
    if (span < shortest) {
      shortest = span;
      best = colour;
    }
  }
  return best;
}

/** Die nächsten Katalogtöne zu einer Standardfarbe, in Katalogfolge. */
export function nearestTones(tones: readonly string[], target: string, count: number): string[] {
  const held = [...new Set(tones)];
  const closest = new Set(
    [...held].sort((one, other) => distance(one, target) - distance(other, target)).slice(0, count),
  );
  return held.filter((tone) => closest.has(tone));
}

/** Die Gruppen des Filterblatts, in der Reihenfolge der Karten. */
export const GROUP_KEYS = [
  'edibility',
  'hymenium',
  'capShape',
  'colour',
  'period',
  'senses',
  'treePartner',
  'genusFamily',
  'protection',
  'forecast',
] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

/** Die Gruppen, die eine Liste aus Werten führen. */
export const CHOICE_GROUPS: readonly GroupKey[] = [
  'edibility',
  'hymenium',
  'capShape',
  'period',
  'senses',
  'treePartner',
  'genusFamily',
  'protection',
  'forecast',
];

/** Der wählbare Wert der Gruppe Vorhersage. */
export const FORECAST_VALUE = 'on';

/** Die Gegenseite der Gruppe Vorhersage. Sie steht nie im Filterblatt. */
export const FORECAST_ABSENT = 'off';

/** Die Achsen einer Art, einmal gerechnet und danach nur gelesen. */
export interface Facts {
  readonly values: ReadonlyMap<GroupKey, readonly string[]>;
  readonly colours: ReadonlyMap<string, readonly string[]>;
}

/** Die Wahl im Filterblatt. */
export interface Selection {
  readonly values: ReadonlyMap<GroupKey, ReadonlySet<string>>;
  readonly colours: ReadonlyMap<string, string>;
  readonly keepUnknown: ReadonlySet<GroupKey>;
}

export const EMPTY_SELECTION: Selection = {
  values: new Map(),
  colours: new Map(),
  keepUnknown: new Set(),
};

/** Ob eine Art trifft, an fehlenden Angaben scheitert oder ausscheidet. */
export type Verdict = 'hit' | 'unknown' | 'miss';

function months(entry: SpeciesEntry): string[] {
  const start = entry.periodStartMonth;
  const end = entry.periodEndMonth;
  if (start === null || start === undefined || end === null || end === undefined) return [];
  const found: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const inside = start <= end ? month >= start && month <= end : month >= start || month <= end;
    if (inside) found.push(String(month));
  }
  return found;
}

function capShapes(entry: SpeciesEntry): string[] {
  return [entry.capShapeYoung, entry.capShapeOld].filter((shape) => Boolean(shape)) as string[];
}

/** Rechnet die Achsen einer Art gegen die Palette des Bündels. */
export function factsOf(entry: SpeciesEntry, palette: readonly StandardColour[]): Facts {
  const terms = entry.terms.map((held) => held.term);
  const values = new Map<GroupKey, readonly string[]>([
    ['edibility', [entry.edibility]],
    ['hymenium', entry.hymeniumType ? [entry.hymeniumType] : []],
    ['capShape', [...new Set(capShapes(entry))]],
    ['period', months(entry)],
    ['protection', [entry.protection]],
    ['forecast', [entry.forecastEnabled ? FORECAST_VALUE : FORECAST_ABSENT]],
    ['genusFamily', [entry.genusName, entry.familyName ?? ''].filter(Boolean)],
    ['senses', terms.filter((term) => isSense(term.kind)).map((term) => term.slug)],
    ['treePartner', terms.filter((term) => term.kind === 'tree').map((term) => term.slug)],
  ]);
  const colours = new Map<string, readonly string[]>();
  for (const group of entry.colours) {
    const keys = group.colours
      .map((one) => nearestColour(one.hex, palette)?.key)
      .filter((key): key is string => key !== undefined);
    colours.set(group.part, [...new Set(keys)]);
  }
  return { values, colours };
}

function isSense(kind: string): boolean {
  return kind === 'smell' || kind === 'taste';
}

/** Zählt, ob eine Gruppe trifft, nichts weiß oder ausscheidet. */
function judgeGroup(held: readonly string[], wanted: ReadonlySet<string>): Verdict {
  if (wanted.size === 0) return 'hit';
  if (held.length === 0) return 'unknown';
  return held.some((value) => wanted.has(value)) ? 'hit' : 'miss';
}

/** Prüft eine Art gegen die Wahl. */
export function judge(facts: Facts, selection: Selection, palette: readonly StandardColour[]): Verdict {
  let unknown = false;
  for (const [key, wanted] of selection.values) {
    const verdict = judgeGroup(facts.values.get(key) ?? [], wanted);
    if (verdict === 'miss') return 'miss';
    if (verdict === 'unknown' && !selection.keepUnknown.has(key)) unknown = true;
  }
  for (const [part, hex] of selection.colours) {
    const held = facts.colours.get(part) ?? [];
    if (held.length === 0) unknown = unknown || !selection.keepUnknown.has('colour');
    else if (!held.includes(nearestColour(hex, palette)?.key ?? '')) return 'miss';
  }
  return unknown ? 'unknown' : 'hit';
}

/** Ob die Wahl überhaupt einschränkt. */
export function isActive(selection: Selection): boolean {
  const chosen = [...selection.values.values()].some((values) => values.size > 0);
  return chosen || selection.colours.size > 0;
}

/** Die gezählten Achsen des Bündels. */
export type Counts = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** Wie viele Arten einen Wert tragen, über den ganzen Katalog. */
export function countValues(counts: Counts, key: string): Readonly<Record<string, number>> {
  return counts[key] ?? {};
}

/** Wie viele Arten für einen Körperteil eine Standardfarbe tragen. */
export function countColours(counts: Counts, part: BodyPart): Readonly<Record<string, number>> {
  return counts[`colour.${part}`] ?? {};
}

/** Wie viele Arten zu einer Gruppe keine Angabe tragen. */
export function countUnknown(counts: Counts, key: GroupKey): number {
  return countValues(counts, 'unknown')[key] ?? 0;
}

/** Die Körperteile, für die das Bündel Farben zählt. */
export function colourParts(counts: Counts): string[] {
  return Object.keys(counts)
    .filter((axis) => axis.startsWith('colour.'))
    .map((axis) => axis.slice('colour.'.length));
}
