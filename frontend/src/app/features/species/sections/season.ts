import type { SpeciesManifest } from '../../../core/tiles/manifest';

const WEEKS = 52;

/** The weekly series of a species: the latest year as a line, older years as an area. */
export interface SeasonData {
  /** Mean per calendar week over the older years. */
  past: readonly number[];
  /** Mean per calendar week of the latest year. */
  current: readonly number[];
  /** The latest year and its last week. */
  year: number;
  week: number;
  /** The first and the last of the older years. */
  from: number;
  to: number;
}

/** Converts the weeks of a manifest into two series. */
export function seasonData(manifest: SpeciesManifest | null): SeasonData | null {
  const weeks = manifest?.weeks ?? [];
  if (weeks.length === 0) return null;
  const years = [...new Set(weeks.map((one) => one.year))].sort((a, b) => a - b);
  const year = years[years.length - 1];
  const older = years.filter((one) => one !== year);
  const current = weeks.filter((one) => one.year === year).sort((a, b) => a.week - b.week);
  return {
    past: mean(weeks.filter((one) => one.year !== year)),
    current: current.map((one) => one.mean),
    year,
    week: current[current.length - 1]?.week ?? 0,
    from: older[0] ?? year,
    to: older[older.length - 1] ?? year,
  };
}

/** The mean per calendar week over all given weeks. */
function mean(weeks: readonly SpeciesManifest['weeks'][number][]): readonly number[] {
  const sums = new Array<number>(WEEKS).fill(0);
  const counts = new Array<number>(WEEKS).fill(0);
  for (const one of weeks) {
    const at = one.week - 1;
    if (at < 0 || at >= WEEKS) continue;
    sums[at] += one.mean;
    counts[at] += 1;
  }
  return sums.map((sum, at) => (counts[at] === 0 ? 0 : sum / counts[at]));
}
