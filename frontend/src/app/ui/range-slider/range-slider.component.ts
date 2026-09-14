import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Welche Griffe die Spur trägt. `from` und `to` sind die Bedingungen „über“
 * und „unter“: eine Grenze steht am Ende der Skala und lässt sich nicht ziehen.
 */
export type Handles = 'both' | 'from' | 'to';

/**
 * Ein oder zwei Griffe über einer Spur. Jeder Griff ist ein eigener
 * Schieberegler des Browsers, damit Tastatur und Hilfsmittel ohne eigenes
 * Zutun stimmen.
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

  readonly fromChange = output<number>();
  readonly toChange = output<number>();

  protected readonly fromShare = computed(() => this.share(this.from()));
  protected readonly toShare = computed(() => this.share(this.to()));
  protected readonly showsFrom = computed(() => this.handles() !== 'to');
  protected readonly showsTo = computed(() => this.handles() !== 'from');

  /** Die Griffe dürfen sich nicht überholen, sonst kehrt sich die Bedingung um. */
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
