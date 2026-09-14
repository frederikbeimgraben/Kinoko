import { formatValue, formatNumber, type Layer } from '../../core/tiles/layers';
import { EDGE_SHARE, type CombinationBound } from '../../map/value-colors';
import type { Condition, WireFactor } from '../../core/api/models';

/** Ein Faktor: eine Quelle mit einer Bedingung in ihrer Einheit. */
export interface Factor {
  source: string;
  condition: Condition;
  low: number;
  high: number;
  active: boolean;
}

/** Kurzform der Bedingung in der Ablage. */
const SHORT: Record<Condition, string> = { below: 'le', above: 'ge', between: 'bw' };

const FROM_SHORT: Record<string, Condition> = { le: 'below', ge: 'above', bw: 'between' };

const SOURCE_PATTERN = /^[a-z0-9_-]{1,60}$/;

/** Die Kombination als ein Wert. Ein abgehakter Faktor trägt ein `!` vorn. */
export function encodeFactors(factors: readonly Factor[]): string {
  return factors.map(encodeFactor).join(',');
}

function encodeFactor(factor: Factor): string {
  const head = `${factor.active ? '' : '!'}${factor.source}:${SHORT[factor.condition]}`;
  if (factor.condition === 'between') return `${head}:${numberText(factor.low)}:${numberText(factor.high)}`;
  return `${head}:${numberText(factor.condition === 'below' ? factor.high : factor.low)}`;
}

/** Ohne Nachkommastellen, wo keine nötig sind: `0.3`, aber `80`. */
function numberText(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function readFactors(text: string | null): Factor[] {
  if (text === null || text === '') return [];
  return text
    .split(',')
    .map(readFactor)
    .filter((factor): factor is Factor => factor !== null);
}

function readFactor(text: string): Factor | null {
  const parts = text.split(':');
  const active = !parts[0].startsWith('!');
  const source = active ? parts[0] : parts[0].slice(1);
  const condition = FROM_SHORT[parts[1]] as Condition | undefined;
  if (!SOURCE_PATTERN.test(source) || !condition) return null;
  const first = Number(parts[2]);
  const second = Number(parts[3]);
  if (!Number.isFinite(first)) return null;
  if (condition === 'between') {
    if (!Number.isFinite(second)) return null;
    return { source, condition, low: Math.min(first, second), high: Math.max(first, second), active };
  }
  return {
    source,
    condition,
    low: condition === 'above' ? first : 0,
    high: condition === 'below' ? first : 0,
    active,
  };
}

/** Die Bedingung als Spanne über der Skala der Quelle, in ihrer Einheit. */
export function span(factor: Factor, layer: Layer): { low: number; high: number } {
  if (factor.condition === 'below') return { low: layer.low, high: factor.high };
  if (factor.condition === 'above') return { low: factor.low, high: layer.high };
  return { low: factor.low, high: factor.high };
}

/** Die Bedingung in Worten, etwa `≥ 80 mm`. */
export function conditionText(factor: Factor, layer: Layer, locale: string, to: string): string {
  if (factor.condition === 'below') return `≤ ${formatValue(factor.high, layer, locale)}`;
  if (factor.condition === 'above') return `≥ ${formatValue(factor.low, layer, locale)}`;
  // Die Einheit steht einmal, am Ende der Spanne, nicht zweimal.
  const left = formatNumber(factor.low, layer, locale);
  return `${left} ${to} ${formatValue(factor.high, layer, locale)}`;
}

/** Der Wert als Byte. Byte 0 heißt „keine Daten“, die Skala beginnt bei 1. */
export function byteForValue(layer: Layer, value: number): number {
  const width = layer.high - layer.low;
  const relative = width === 0 ? 0 : (value - layer.low) / width;
  return Math.min(255, Math.max(1, Math.round(1 + relative * 254)));
}

/** Die Bedingung, wie der Worker sie braucht: in Bytes, mit Randbreite. */
export function boundFor(factor: Factor, layer: Layer): CombinationBound {
  const values = span(factor, layer);
  return {
    from: byteForValue(layer, values.low),
    to: byteForValue(layer, values.high),
    edge: Math.round(254 * EDGE_SHARE),
  };
}

/** Ein Faktor je Quelle: derselbe Wert zweimal zu prüfen hilft niemandem. */
export function replaceFactor(factors: readonly Factor[], next: Factor): Factor[] {
  const spot = factors.findIndex((factor) => factor.source === next.source);
  if (spot < 0) return [...factors, next];
  return factors.map((factor, i) => (i === spot ? next : factor));
}

/** Eine Kennung der Kombination. MapLibre verwirft damit alte Kacheln. */
export function combinationKey(parts: readonly string[]): string {
  let hash = 5381;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

/** Ein Faktor für den Draht. Nur die gebrauchte Grenze steht darin. */
export function toWire(factor: Factor): WireFactor {
  return {
    source: factor.source,
    condition: factor.condition,
    low: factor.condition === 'below' ? null : factor.low,
    high: factor.condition === 'above' ? null : factor.high,
    active: factor.active,
  };
}

/** Ein Faktor vom Draht. Eine leere Grenze wird zu null, damit sie zählt. */
export function fromWire(factor: WireFactor): Factor {
  return {
    source: factor.source,
    condition: factor.condition,
    low: factor.low ?? 0,
    high: factor.high ?? 0,
    active: factor.active,
  };
}
