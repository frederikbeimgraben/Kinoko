/** The weeks of the curve. A 53rd week shows on the last point. */
export const WEEKS = 52;
const MONTHS = 12;

/** The first week of a month, 1 to 52. */
export function startWeek(month: number): number {
  return Math.round(((month - 1) * WEEKS) / MONTHS) + 1;
}

/** The last week of a month, 1 to 52. */
export function endWeek(month: number): number {
  return Math.round((month * WEEKS) / MONTHS);
}

/** The month that holds most of a week, as the backend gives it to the peak month. */
export function monthOfWeek(week: number): number {
  return new Date(Date.UTC(2025, 0, 2 + (Math.min(week, WEEKS) - 1) * 7)).getUTCMonth() + 1;
}

/** The distance of two weeks on the circle of the year: a winter season passes the new year. */
function apart(one: number, other: number): number {
  const direct = Math.abs(one - other);
  return Math.min(direct, WEEKS - direct);
}

/** The season as one value per week: a bell at the peak, as wide as the period allows.
 * Without a peak, the bell is at the centre of the period. */
export function seasonCurve(from: number, to: number, peak: number | null): readonly number[] {
  const first = startWeek(from);
  const span = (endWeek(to) - first + WEEKS) % WEEKS || WEEKS;
  const centre = peak ?? ((first - 1 + span / 2) % WEEKS) + 1;
  const width = Math.max(1.5, span * 0.15);
  return Array.from({ length: WEEKS }, (_, at) => Math.exp(-0.5 * (apart(at + 1, centre) / width) ** 2));
}

/** The line and the closed area of a curve in a box of `width` × `height`. Each week ends at its share
 * of the width. The line starts at the left edge with the last week, as the year is a circle. */
export function curvePaths(
  values: readonly number[],
  width: number,
  height: number,
): { line: string; area: string } {
  const step = width / values.length;
  const point = (x: number, value: number): string =>
    `${x.toFixed(1)},${(height - value * height).toFixed(1)}`;
  const points = [point(0, values.at(-1) ?? 0), ...values.map((value, at) => point((at + 1) * step, value))];
  const line = `M${points.join(' L')}`;
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}
