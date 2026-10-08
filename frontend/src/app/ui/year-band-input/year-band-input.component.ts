import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;

/** A period in the year as a band with two handles, in steps of one month. */
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

  /** The handles must not pass each other. Otherwise the period turns around. */
  protected onFrom(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.fromChange.emit(Math.min(value, this.to()));
  }

  protected onTo(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.toChange.emit(Math.max(value, this.from()));
  }
}

/** One month fills one twelfth of the band. */
function share(edge: number): string {
  return `${(edge / LAST_MONTH) * 100}%`;
}
