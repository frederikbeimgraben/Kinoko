/** Ein Katalog mit 306 Arten, dessen Zahlen den Brettern des Filters folgen. */

import { species } from './species';

const TOTAL = 306;
const EDIBILITY: readonly (readonly [string, number])[] = [
  ['edible', 77],
  ['conditionally_edible', 5],
  ['inedible', 142],
  ['poisonous', 68],
  ['deadly', 14],
];
const SHAPES: readonly (readonly [string, number])[] = [
  ['convex', 34],
  ['flat', 41],
  ['hemispherical', 26],
  ['depressed', 30],
  ['funnel', 27],
  ['conical', 11],
  ['bell', 9],
  ['egg', 9],
];
const SHAPED = 94;
/** Die sechs Katalogtöne des Bretts `FilterColour`, in seiner Reihenfolge. */
const TONES: readonly (readonly string[])[] = [
  ['#6b4423'],
  ['#5e3d22'],
  ['#7a5230'],
  ['#6b4423', '#8a4e2b'],
  ['#5a3a1e'],
  ['#6b4423', '#4a3220'],
];
const BROWN_CAPS = 41;
const CORE = 31;
const FORECAST = 15;
const STRICT = 23;
const MEASURED = 63;

function pool(counts: readonly (readonly [string, number])[]): string[] {
  return counts.flatMap(([value, count]) => Array.from({ length: count }, () => value));
}

const EDIBILITIES = pool(EDIBILITY);
const SHAPE_POOL = pool(SHAPES);

function shapesOf(at: number): string[] {
  if (at >= SHAPED) return [];
  return SHAPE_POOL.slice(SHAPED + at, SHAPED + at + 1)
    .concat(SHAPE_POOL[at])
    .reverse();
}

function capOf(at: number): readonly string[] {
  if (at >= BROWN_CAPS) return [];
  return at < TONES.length ? TONES[at] : ['#6b4423'];
}

/** Die 306 Arten des Katalogs, als Bündel des Vertrags. */
export function largeBundle(): Record<string, unknown> {
  const items = Array.from({ length: TOTAL }, (_, at) =>
    species(
      {
        slug: `art-${String(at)}`,
        name: `Art ${String(at)}`,
        latin: `Genus specimen${String(at)}`,
        edibility: EDIBILITIES[at],
        cap: capOf(at),
        stem: at < CORE ? ['#e8d9b5'] : [],
        sporePrint: at < CORE ? ['#3e2a17'] : [],
        gills: at >= 100 && at < 120 ? ['#f3efe6'] : [],
        flesh: at >= 120 && at < 140 ? ['#f3efe6'] : [],
        hymenium: at < CORE ? 'gills' : null,
        capShapes: shapesOf(at),
        months: at < MEASURED ? [8, 10] : undefined,
        capWidth: at < MEASURED ? [5, 10] : undefined,
        protection: at < STRICT ? 'strict' : 'none',
        forecast: at < FORECAST,
      },
      at,
    ),
  );
  return { items };
}

/** Die Wahl hinter den Brettern `SpeciesFilter` und `FilterEdibility`. */
export const CORE_CHOICE = {
  values: { edibility: ['edible'], hymenium: ['gills'], period: ['9'] },
  colours: { cap: '#6b4423', stem: '#e8d9b5', spore_print: '#3e2a17' },
  sizes: {},
  keepUnknown: [],
};

/** Die Wahl hinter dem Brett `FilterCapShape`. */
export const FORECAST_CHOICE = {
  ...CORE_CHOICE,
  values: { ...CORE_CHOICE.values, forecast: ['on'] },
};

/** Die Wahl hinter dem Brett `FilterColour`. */
export const STRICT_CHOICE = {
  ...CORE_CHOICE,
  values: { ...CORE_CHOICE.values, protection: ['strict'] },
};

/** Die Wahl hinter dem Brett `FilterSize`. */
export const SIZE_CHOICE = {
  values: { period: ['8', '9', '10'] },
  colours: {},
  sizes: { 'cap.width': [4, 12] },
  keepUnknown: [],
};
