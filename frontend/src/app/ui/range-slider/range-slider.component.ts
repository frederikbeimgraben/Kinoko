import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** The thumbs on the track. A fixed bound is at the end of the scale. */
export type Handles = 'both' | 'from' | 'to';

/** The thumb: a light ring for a span, a solid dot for a share. */
export type SliderVariant = 'ring' | 'dot';

/**
 * One or two thumbs on a track. Each thumb is a native range input.
 */
@Component({
  selector: 'app-range-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './range-slider.component.html',
  styleUrl: './range-slider.component.scss',
})
export class RangeSliderComponent {
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly from = input.required<number>();
  readonly to = input.required<number>();
  readonly handles = input<Handles>('both');
  readonly variant = input<SliderVariant>('ring');

  readonly fromChange = output<number>();
  readonly toChange = output<number>();

  protected readonly fromShare = computed(() => this.share(this.from()));
  protected readonly toShare = computed(() => this.share(this.to()));
  protected readonly showsFrom = computed(() => this.handles() !== 'to');
  protected readonly showsTo = computed(() => this.handles() !== 'from');

  /** The thumbs must not pass each other. Otherwise the condition inverts. */
  protected onFrom(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.fromChange.emit(Math.min(value, this.to()));
  }

  protected onTo(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.toChange.emit(Math.max(value, this.from()));
  }

  private share(value: number): string {
    const span = this.max() - this.min() || 1;
    return `${((value - this.min()) / span) * 100}%`;
  }
}
