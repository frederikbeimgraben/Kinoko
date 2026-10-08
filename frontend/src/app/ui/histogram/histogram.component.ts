import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Bar {
  /** The height in percent of the area. */
  height: number;
  inside: boolean;
}

/** The distribution of a layer, per the board `Histogram`. The classes inside the condition show in the primary colour. */
@Component({
  selector: 'app-histogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './histogram.component.html',
  styleUrl: './histogram.component.scss',
})
export class HistogramComponent {
  readonly shares = input.required<readonly number[]>();
  readonly label = input.required<string>();
  /** The lower and the upper limit of the condition, values from 0 to 1. */
  readonly from = input(0);
  readonly to = input(1);
  readonly height = input(72);

  protected readonly bars = computed<Bar[]>(() => {
    const shares = this.shares();
    const count = shares.length || 1;
    const top = Math.max(...shares, Number.EPSILON);
    return shares.map((value, i) => {
      const position = i / count;
      return {
        height: Math.max(4, (value / top) * 100),
        inside: position >= this.from() && position <= this.to(),
      };
    });
  });
}
