import { FORECAST_RAMP } from '../ui/ramp/ramp-colours';

/** Colour and opacity per byte, four values per entry: 256 × RGBA. */
export const LUT_SIZE = 256 * 4;

/** `probability`: byte 1–255 gives `(byte - 1) / 254 * top`, as `modell/src/pilze/tiles.py` writes it.
 * `range`: byte 1–255 gives `low + (byte - 1) / 254 * (high - low)` in the unit of the layer. */
export type ValueScale = { kind: 'probability'; top: number } | { kind: 'range'; low: number; high: number };

// A forecast scales opacity with the value. A layer keeps one opacity, so a low value does not look like missing data.
// `region_map.py`, `render` uses the same calculation.
const OPACITY_BASE = 0.1;
const OPACITY_RANGE = 0.85;
const OPACITY_MAX = 240;
const OPACITY_FLAT = 215;

export function toRgb(farbe: string): [number, number, number] {
  const number = Number.parseInt(farbe.replace('#', ''), 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

export function valueBytes(scale: ValueScale, byte: number): number {
  const relative = (byte - 1) / 254;
  if (scale.kind === 'probability') return relative * scale.top;
  return scale.low + relative * (scale.high - scale.low);
}

/** Two sources with the same scale and ramp share one lookup table under this key. */
export function scaleKey(scale: ValueScale, colors: readonly string[]): string {
  const span =
    scale.kind === 'probability' ? String(scale.top) : `${String(scale.low)}:${String(scale.high)}`;
  return `${scale.kind}|${span}|${colors.join(',')}`;
}

/** Byte 0 means no data and stays transparent. */
export function createLut(scale: ValueScale, colors: readonly string[] = FORECAST_RAMP): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const levels = colors.map(toRgb);
  const last = levels.length - 1;
  for (let byte = 1; byte < 256; byte++) {
    const relative = (byte - 1) / 254;
    // A forecast uses the absolute value. A layer uses its full range,
    // so that a narrow range (for example pH 4.7 to 6.9) does not show one colour.
    const spot = (scale.kind === 'probability' ? Math.min(relative * scale.top, 1) : relative) * last;
    const bottom = Math.floor(spot);
    const top = Math.min(bottom + 1, last);
    const share = spot - bottom;
    const target = byte * 4;
    for (let channel = 0; channel < 3; channel++) {
      lut[target + channel] = levels[bottom][channel] * (1 - share) + levels[top][channel] * share;
    }
    lut[target + 3] =
      scale.kind === 'probability'
        ? Math.min(1, OPACITY_BASE + relative * OPACITY_RANGE) * OPACITY_MAX
        : OPACITY_FLAT;
  }
  return lut;
}

/**
 * Colours a decoded tile in place. The value tile is grey, so the red channel holds the byte.
 */
export function colorize(pixel: Uint8ClampedArray, lut: Uint8ClampedArray): void {
  for (let i = 0; i < pixel.length; i += 4) {
    const target = pixel[i] * 4;
    pixel[i] = lut[target];
    pixel[i + 1] = lut[target + 1];
    pixel[i + 2] = lut[target + 2];
    pixel[i + 3] = lut[target + 3];
  }
}

export type CombinationRule = 'intersection' | 'graded';

/** The intersection is a mask: one colour, half opaque, so the map below stays visible. */
export const INTERSECTION_OPACITY = 140;

/** The degree falls to zero over this share of the layer scale outside the bound.
 * Without this edge, "graded" gives the same result as the intersection. */
export const EDGE_SHARE = 0.1;

/** A point where one or more sources have no data. */
export const EMPTY_DOT = -1;

/** The bound of a factor, in bytes. */
export interface CombinationBound {
  from: number;
  to: number;
  /** Width in bytes of the edge over which the degree falls to zero. */
  edge: number;
}

/** The degree (0 to 1) to which a byte meets the bound. */
export function fulfilment(byte: number, bound: CombinationBound): number {
  if (byte >= bound.from && byte <= bound.to) return 1;
  const gap = byte < bound.from ? bound.from - byte : byte - bound.to;
  if (bound.edge <= 0) return 0;
  return Math.max(0, 1 - gap / bound.edge);
}

/** Gives 0 to 1, or {@link EMPTY_DOT} when a source has byte 0. The intersection gives 0 or 1.
 * "graded" uses the geometric mean, so one bad factor lowers the result more than an arithmetic mean. */
export function combine(
  bytes: readonly number[],
  bounds: readonly CombinationBound[],
  rule: CombinationRule,
): number {
  if (bytes.length === 0) return EMPTY_DOT;
  let product = 1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return EMPTY_DOT;
    const degree = fulfilment(bytes[i], bounds[i]);
    if (rule === 'intersection') {
      if (degree < 1) return 0;
    } else {
      if (degree === 0) return 0;
      product *= degree;
    }
  }
  return rule === 'intersection' ? 1 : product ** (1 / bytes.length);
}

/**
 * "graded" uses the full ramp like a forecast. Low opacity keeps weak points in the background.
 */
export function createCombinationLut(colors: readonly string[], rule: CombinationRule): Uint8ClampedArray {
  if (rule === 'graded') return createLut({ kind: 'probability', top: 1 }, colors);
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const [r, g, b] = toRgb(colors[0]);
  for (let byte = 1; byte < 256; byte++) {
    const target = byte * 4;
    lut[target] = r;
    lut[target + 1] = g;
    lut[target + 2] = b;
    lut[target + 3] = INTERSECTION_OPACITY;
  }
  return lut;
}

export function combinationIndex(value: number): number {
  if (value <= 0) return 0;
  return 1 + Math.round(Math.min(value, 1) * 254);
}
