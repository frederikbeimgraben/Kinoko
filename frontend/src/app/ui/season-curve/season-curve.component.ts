import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The marks on the baseline are at the start of the months Jan, Mar, … Nov. */
const MONTH_MARKS = [0, 9, 18, 27, 36, 44] as const;

/** Below this share of the maximum visits, a week is thin. */
const THIN_BELOW = 0.25;

/** Centred moving average. At the edges, only the existing neighbours count. */
export function smooth(series: readonly number[], windowSize: number): readonly number[] {
  if (windowSize <= 1) return series;
  const half = Math.floor(windowSize / 2);
  return series.map((_, i) => {
    const first = Math.max(0, i - half);
    const last = Math.min(series.length - 1, i + half);
    let sum = 0;
    for (let k = first; k <= last; k++) sum += series[k];
    return sum / (last - first + 1);
  });
}

let nextNumber = 0;

/** A strip over a week with few visits. */
interface Strip {
  x: number;
  width: number;
}

/** A month mark below the curve: the name and the week in which the month starts. */
export interface MonthMark {
  text: string;
  week: number;
}

/** The shape of a series: an area for all years, a line for the current year. */
export type SeasonShape = 'area' | 'line';

/** A series of the curve with its visits and its legend. */
export interface SeasonSeries {
  readonly shape: SeasonShape;
  readonly values: readonly number[];
  /** Visits for each calendar week. Few visits make the week thin. */
  readonly visits?: readonly number[];
  readonly legend?: string;
}

/** A placed month mark with its position as a share of the width. */
interface PlacedMark {
  text: string;
  left: number;
}

interface Drawing {
  width: number;
  height: number;
  area: string;
  currentArea: string;
  currentLine: string;
  hasCurrent: boolean;
  badges: number[];
  /** The end point as a share of the area, in percent. It is outside the SVG
   * because the stretched plot area makes a circle into an ellipse. */
  endLeft: number;
  endTop: number;
  thin: Strip[];
}

/** The season curve of a species: all years as an area, the current year as a line. */
@Component({
  selector: 'app-season-curve',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-curve.component.html',
  styleUrl: './season-curve.component.scss',
})
export class SeasonCurveComponent {
  readonly series = input.required<readonly SeasonSeries[]>();
  readonly label = input.required<string>();
  readonly large = input(false);
  /** The month names below the baseline, each on its week. */
  readonly months = input<readonly MonthMark[]>([]);
  /** The width of the moving average in weeks. 1 draws the raw values. */
  readonly smoothing = input(3);
  /** The maximum of the scale as text, for example „32 %“. An empty value does not show. */
  readonly peak = input('');

  protected readonly maskId = `funke-dicht-${nextNumber++}`;
  protected readonly drawing = computed<Drawing>(() => this.compute());

  /** The line comes first in the legend, as it is on top of the area. */
  protected readonly legend = computed<readonly SeasonSeries[]>(() =>
    [...this.series()]
      .filter((row) => row.legend)
      .sort((one, other) => Number(other.shape === 'line') - Number(one.shape === 'line')),
  );

  private values(shape: SeasonShape): readonly number[] {
    return this.series().find((row) => row.shape === shape)?.values ?? [];
  }

  private compute(): Drawing {
    const large = this.large();
    const width = large ? 330 : 88;
    const height = large ? 72 : 36;
    const windowSize = this.smoothing();
    const rawArea = this.values('area');
    const rawLine = this.values('line');
    const area = smooth(rawArea, windowSize);
    const current = smooth(rawLine, windowSize);
    // The maximum comes from the raw data, not from the smoothed series.
    // The smallest number as a floor prevents a division by zero.
    const top = Math.max(...rawArea, ...rawLine, Number.EPSILON);
    const point = (i: number, value: number): [number, number] => [
      (i / 51) * width,
      height - 3 - (value / top) * (height - 8),
    ];
    const areaP = area.map((value, i) => point(i, value));
    const currentP = current.map((value, i) => point(i, value));
    const last = currentP.at(-1) ?? [0, height];
    return {
      width,
      height,
      area: `M0,${height} ${areaP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${width},${height} Z`,
      currentArea: `M0,${height} ${currentP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${last[0].toFixed(1)},${height} Z`,
      currentLine: `M${currentP.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`,
      hasCurrent: currentP.length > 0,
      badges: MONTH_MARKS.map((k) => (k / 51) * width),
      endLeft: (last[0] / width) * 100,
      endTop: (last[1] / height) * 100,
      thin: this.thinWeeks(width),
    };
  }

  /** Places the month marks on the scale of the curve, as a share of the width. */
  protected readonly monthMarks = computed<PlacedMark[]>(() =>
    this.months().map((badge) => ({
      text: badge.text,
      left: ((badge.week - 1) / 51) * 100,
    })),
  );

  /** Gives the weeks with few visits, each series on its own scale. */
  private thinWeeks(width: number): Strip[] {
    const rows = this.series()
      .map((row) => row.visits ?? [])
      .filter((visits) => visits.length > 0);
    if (rows.length === 0) return [];
    const thresholds = rows.map((series) => Math.max(...series) * THIN_BELOW);
    const step = width / 51;
    const strip: Strip[] = [];
    for (let i = 0; i < Math.max(...rows.map((series) => series.length)); i++) {
      const thin = rows.some((series, r) => i < series.length && series[i] < thresholds[r]);
      if (!thin) continue;
      const x = Math.max(0, (i - 0.5) * step);
      strip.push({ x, width: Math.min(width, (i + 0.5) * step) - x });
    }
    return strip;
  }
}
