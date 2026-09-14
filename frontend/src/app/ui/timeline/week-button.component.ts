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

/** Eine Woche in der Zeitleiste. Eine Prognosewoche trägt einen gestrichelten Rand. */
@Component({
  selector: 'app-week-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './week-button.component.html',
  styleUrl: './week-button.component.scss',
})
export class WeekButtonComponent {
  private readonly i18n = inject(I18nService);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  readonly year = input.required<number>();
  readonly week = input.required<number>();
  /** Balkenhöhe zwischen 0 und 1. */
  readonly share = input(0);
  readonly forecast = input(false);
  readonly active = input(false);
  /** Die erste Woche eines Jahres trägt die Jahreszahl über sich. */
  readonly yearMark = input(false);
  /** Nur eine Woche der Leiste liegt im Tabulator-Weg; die Pfeile führen weiter. */
  readonly inTabOrder = input(true);
  /** Gesperrt, solange die Darstellung keine Woche kennt. */
  readonly locked = input(false);

  readonly chosen = output();

  protected readonly bars = computed(() => `${Math.round(Math.min(Math.max(this.share(), 0), 1) * 100)}%`);

  /** Der Knopf selbst; die Leiste schiebt ihn in Sicht. */
  element(): HTMLButtonElement {
    return this.button().nativeElement;
  }

  protected label(): string {
    const text = this.i18n.translate('map.week.value', { week: this.week(), year: this.year() });
    return this.forecast() ? `${text} · ${this.i18n.translate('map.week.forecast')}` : text;
  }
}
