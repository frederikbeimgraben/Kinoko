import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { FILLED_ICONS, ICONS, type IconName } from './icons';

export type { IconName };

/** A dim icon reads var(--label), otherwise it inherits its color. */
export type IconTone = '' | 'dim';

/** Ein Piktogramm aus der festen Tabelle. Ohne Beschriftung bleibt es Schmuck. */
@Component({
  selector: 'app-svg-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './svg-icon.component.html',
  styleUrl: './svg-icon.component.scss',
})
export class SvgIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly label = input<string>();
  readonly size = input<number>(22);
  readonly strokeWidth = input<number>(2);
  readonly tone = input<IconTone>('');

  protected readonly filled = computed(() => FILLED_ICONS.includes(this.name()));
  protected readonly viewBox = computed(() => (this.filled() ? '0 0 12 12' : '0 0 24 24'));
  protected readonly role = computed(() => (this.label() ? 'img' : null));
  protected readonly hidden = computed(() => (this.label() ? null : true));
  /** `name` ist eine geschlossene Aufzählung. Der Baustein sieht nie Fremdtext. */
  protected readonly markup = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]),
  );
}
