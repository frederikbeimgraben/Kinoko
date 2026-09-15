import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;

/** Ein Zeitraum im Jahr als Band mit zwei Griffen, Monat für Monat. */
@Component({
  selector: 'app-year-band-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './year-band-input.component.html',
  styleUrl: './year-band-input.component.scss',
})
export class YearBandInputComponent {
  readonly from = input.required<number>();
  readonly to = input.required<number>();
  readonly label = input.required<string>();

  readonly fromChange = output<number>();
  readonly toChange = output<number>();

  protected readonly firstMonth = FIRST_MONTH;
  protected readonly lastMonth = LAST_MONTH;

  protected readonly fromShare = computed(() => share(this.from() - 1));
  protected readonly toShare = computed(() => share(this.to()));

  /** Die Griffe dürfen sich nicht überholen, sonst kehrt sich der Zeitraum um. */
  protected onFrom(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.fromChange.emit(Math.min(value, this.to()));
  }

  protected onTo(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.toChange.emit(Math.max(value, this.from()));
  }
}

/** Ein Monat belegt ein Zwölftel des Bandes. */
function share(edge: number): string {
  return `${(edge / LAST_MONTH) * 100}%`;
}
