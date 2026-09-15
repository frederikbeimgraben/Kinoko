import type { BodyPart, SpeciesEntry } from '../../core/api/models';
import { nearestColour } from './standard-colours';

/** Die Gruppen des Filterblatts, in der Reihenfolge der Karten. */
export const GROUP_KEYS = [
  'edibility',
  'hymenium',
  'capShape',
  'colour',
  'size',
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

/** Der Wert der Gruppe Vorhersage. Sie kennt nur an oder gar nicht. */
export const FORECAST_VALUE = 'on';

/** Die Achsen einer Art, einmal gerechnet und danach nur gelesen. */
export interface Facts {
  readonly values: ReadonlyMap<GroupKey, readonly string[]>;
  readonly colours: ReadonlyMap<string, readonly string[]>;
  readonly sizes: ReadonlyMap<string, readonly [number, number]>;
}

/** Die Wahl im Filterblatt. */
export interface Selection {
  readonly values: ReadonlyMap<GroupKey, ReadonlySet<string>>;
  readonly colours: ReadonlyMap<string, string>;
  readonly sizes: ReadonlyMap<string, readonly [number, number]>;
  readonly keepUnknown: ReadonlySet<GroupKey>;
}

export const EMPTY_SELECTION: Selection = {
  values: new Map(),
  colours: new Map(),
  sizes: new Map(),
  keepUnknown: new Set(),
};

/** Ob eine Art trifft, an fehlenden Angaben scheitert oder ausscheidet. */
export type Verdict = 'hit' | 'unknown' | 'miss';

/** Der Schlüssel eines Maßes: Teil und Strecke. */
export function sizeKey(part: string, dimension: string): string {
  return `${part}.${dimension}`;
}

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

/** Rechnet die Achsen einer Art. `kinds` ordnet einen Begriff seiner Art zu. */
export function factsOf(entry: SpeciesEntry, kinds: ReadonlyMap<string, string>): Facts {
  const terms = entry.terms.map((held) => held.term);
  const values = new Map<GroupKey, readonly string[]>([
    ['edibility', [entry.edibility]],
    ['hymenium', entry.hymeniumType ? [entry.hymeniumType] : []],
    ['capShape', [...new Set(capShapes(entry))]],
    ['period', months(entry)],
    ['protection', [entry.protection]],
    ['forecast', entry.forecastEnabled ? [FORECAST_VALUE] : []],
    ['genusFamily', [entry.scientificName.split(' ')[0]]],
    ['senses', terms.filter((term) => isSense(kinds.get(term.id))).map((term) => term.slug)],
    ['treePartner', terms.filter((term) => kinds.get(term.id) === 'tree').map((term) => term.slug)],
  ]);
  const colours = new Map<string, readonly string[]>();
  for (const group of entry.colours) {
    colours.set(group.part, [...new Set(group.colours.map((one) => nearestColour(one.hex).key))]);
  }
  const sizes = new Map<string, readonly [number, number]>();
  for (const group of entry.measurements) {
    for (const measure of group.measurements) {
      sizes.set(sizeKey(group.part, measure.dimension), [measure.low, measure.high]);
    }
  }
  return { values, colours, sizes };
}

function isSense(kind: string | undefined): boolean {
  return kind === 'smell' || kind === 'taste';
}

function overlaps(held: readonly [number, number], wanted: readonly [number, number]): boolean {
  return held[1] >= wanted[0] && held[0] <= wanted[1];
}

/** Zählt, ob eine Gruppe trifft, nichts weiß oder ausscheidet. */
function judgeGroup(held: readonly string[], wanted: ReadonlySet<string>): Verdict {
  if (wanted.size === 0) return 'hit';
  if (held.length === 0) return 'unknown';
  return held.some((value) => wanted.has(value)) ? 'hit' : 'miss';
}

/** Prüft eine Art gegen die Wahl. */
export function judge(facts: Facts, selection: Selection): Verdict {
  let unknown = false;
  for (const [key, wanted] of selection.values) {
    const verdict = judgeGroup(facts.values.get(key) ?? [], wanted);
    if (verdict === 'miss') return 'miss';
    if (verdict === 'unknown' && !selection.keepUnknown.has(key)) unknown = true;
  }
  for (const [part, hex] of selection.colours) {
    const held = facts.colours.get(part) ?? [];
    if (held.length === 0) unknown = unknown || !selection.keepUnknown.has('colour');
    else if (!held.includes(nearestColour(hex).key)) return 'miss';
  }
  for (const [key, wanted] of selection.sizes) {
    const held = facts.sizes.get(key);
    if (held === undefined) unknown = unknown || !selection.keepUnknown.has('size');
    else if (!overlaps(held, wanted)) return 'miss';
  }
  return unknown ? 'unknown' : 'hit';
}

/** Ob die Wahl überhaupt einschränkt. */
export function isActive(selection: Selection): boolean {
  const chosen = [...selection.values.values()].some((values) => values.size > 0);
  return chosen || selection.colours.size > 0 || selection.sizes.size > 0;
}

/** Wie viele Arten einen Wert tragen, über den ganzen Katalog. */
export function countValues(facts: readonly Facts[], key: GroupKey): Map<string, number> {
  const counts = new Map<string, number>();
  for (const one of facts) {
    for (const value of one.values.get(key) ?? []) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

/** Wie viele Arten für einen Körperteil eine Standardfarbe tragen. */
export function countColours(facts: readonly Facts[], part: BodyPart): Map<string, number> {
  const counts = new Map<string, number>();
  for (const one of facts) {
    for (const key of one.colours.get(part) ?? []) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** Wie viele Arten zu einer Gruppe keine Angabe tragen. */
export function countUnknown(facts: readonly Facts[], key: GroupKey): number {
  return facts.filter((one) => (one.values.get(key) ?? []).length === 0).length;
}
