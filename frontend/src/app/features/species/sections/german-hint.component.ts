import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DEFAULT_LOCALE } from '../../../core/i18n/translations';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';

/** The catalogue texts exist in German only. In another language this line tells the reader so. */
export function germanOnly(i18n: I18nService): boolean {
  return i18n.locale() !== DEFAULT_LOCALE;
}

/** The hint above a group with German catalogue texts. It shows only outside German. */
@Component({
  selector: 'app-german-hint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  template: `
    @if (shown()) {
      <p class="hint">
        <app-svg-icon name="info" tone="dim" [size]="16" [strokeWidth]="1.8" />
        <span>{{ 'species.germanOnly' | t }}</span>
      </p>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .hint {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0;
      padding-left: 4px;
      font-size: 13px;
      line-height: 1.4;
      color: var(--text-var);
    }
  `,
})
export class GermanHintComponent {
  private readonly i18n = inject(I18nService);
  protected readonly shown = computed(() => germanOnly(this.i18n));
}
