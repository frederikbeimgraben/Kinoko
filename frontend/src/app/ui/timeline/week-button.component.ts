import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RippleDirective } from '../ripple/ripple.directive';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** A week in the week strip, per the board `WeekCell`. A forecast week has a dashed border. */
@Component({
  selector: 'app-week-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SkeletonComponent, TranslatePipe],
  templateUrl: './week-button.component.html',
  styleUrl: './week-button.component.scss',
})
export class WeekButtonComponent {
  private readonly i18n = inject(I18nService);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  readonly year = input.required<number>();
  readonly week = input.required<number>();
  /** The bar length from 0 to 1. */
  readonly share = input(0);
  readonly forecast = input(false);
  readonly active = input(false);
  /** The first week of a year shows the year above it. */
  readonly yearMark = input(false);
  /** Only one week of the strip is in the tab order. The arrow keys go to the others. */
  readonly inTabOrder = input(true);
  /** Locked while the view has no week. */
  readonly locked = input(false);
  /** Without a manifest, the button shows only a bar. */
  readonly loading = input(false);

  readonly chosen = output();

  protected readonly bars = computed(() => `${Math.round(Math.min(Math.max(this.share(), 0), 1) * 100)}%`);

  /** The button element. The strip scrolls it into view. */
  element(): HTMLButtonElement {
    return this.button().nativeElement;
  }

  protected label(): string {
    const text = this.i18n.translate('map.week.value', { week: this.week(), year: this.year() });
    return this.forecast() ? `${text} · ${this.i18n.translate('map.week.forecast')}` : text;
  }
}
