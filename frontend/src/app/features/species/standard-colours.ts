/** Zwölf Standardfarben und ihr Abstand, wie `FacetService.nearest_colour`. */

export interface StandardColour {
  readonly key: string;
  readonly hex: string;
}

export const STANDARD_COLOURS: readonly StandardColour[] = [
  { key: 'white', hex: '#f3efe6' },
  { key: 'cream', hex: '#e8d9b5' },
  { key: 'yellow', hex: '#e0b446' },
  { key: 'orange', hex: '#d1832f' },
  { key: 'redBrown', hex: '#a0522d' },
  { key: 'brown', hex: '#6b4423' },
  { key: 'darkBrown', hex: '#3e2a17' },
  { key: 'olive', hex: '#7f8a3a' },
  { key: 'green', hex: '#4f7a3a' },
  { key: 'red', hex: '#b8322a' },
  { key: 'violet', hex: '#7a3b6a' },
  { key: 'grey', hex: '#8a8f8a' },
];

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

/** Die nächste Standardfarbe zu einer Katalogfarbe. */
export function nearestColour(value: string): StandardColour {
  let best = STANDARD_COLOURS[0];
  let shortest = Number.POSITIVE_INFINITY;
  for (const colour of STANDARD_COLOURS) {
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
