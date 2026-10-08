import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A part of the track: its start and its width, in percent. */
interface Body {
  left: number;
  width: number;
}

const MONTHS = 12;

/** The year as a track with four marks. The main season is strong, the edge season is pale. */
@Component({
  selector: 'app-year-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './year-band.component.html',
  styleUrl: './year-band.component.scss',
})
export class YearBandComponent {
  readonly fromMonth = input.required<number>();
  readonly toMonth = input.required<number>();
  readonly peakFromMonth = input<number | null>(null);
  readonly peakToMonth = input<number | null>(null);
  /** The marks below the track. Without marks, the row does not show. */
  readonly months = input<readonly string[]>([]);
  readonly label = input.required<string>();

  protected readonly stated = computed(() => bodies(this.fromMonth(), this.toMonth()));

  protected readonly observed = computed(() => {
    const from = this.peakFromMonth();
    const to = this.peakToMonth();
    return from === null || to === null ? [] : bodies(from, to);
  });

  /** Without an observed period, the stated period shows full color. */
  protected readonly muted = computed(() => this.observed().length > 0);
}

/** The bodies of a month range. A range across the year end gives two bodies. */
export function bodies(fromMonth: number, toMonth: number): Body[] {
  const share = 100 / MONTHS;
  if (fromMonth <= toMonth) {
    return [{ left: (fromMonth - 1) * share, width: (toMonth - fromMonth + 1) * share }];
  }
  return [
    { left: 0, width: toMonth * share },
    { left: (fromMonth - 1) * share, width: (MONTHS - fromMonth + 1) * share },
  ];
}
