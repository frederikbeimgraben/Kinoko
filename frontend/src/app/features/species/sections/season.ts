import type { SpeciesManifest } from '../../../core/tiles/manifest';

const WEEKS = 52;

/** Die Wochenreihen einer Art: das jüngste Jahr als Linie, die älteren als Fläche. */
export interface SeasonData {
  /** Mittelwerte je Kalenderwoche über die älteren Jahre. */
  past: readonly number[];
  /** Mittelwerte je Kalenderwoche des jüngsten Jahres, bis zur letzten Woche. */
  current: readonly number[];
  /** Das jüngste Jahr und seine letzte Woche. */
  year: number;
  week: number;
  /** Das erste und das letzte der älteren Jahre. */
  from: number;
  to: number;
}

/** Rechnet die Wochen eines Manifests in zwei Reihen um. */
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

/** Der Mittelwert je Kalenderwoche über alle gegebenen Wochen. */
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
