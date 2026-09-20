import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';
import { RippleDirective } from '../ripple/ripple.directive';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';

/** Der Zustand, den die Leiste meldet. */
export type BannerKind = 'noConnection' | 'pending' | 'update';

/** Die Tönung je Zustand, per `kit.css` `.banner`, `.banner.error`, `.banner.info`. */
type BannerTone = 'warn' | 'error' | 'info';

const TEXT: Record<BannerKind, TranslationKey> = {
  noConnection: 'state.noConnection',
  pending: 'state.offlinePending',
  update: 'app.update.ready',
};

const TONE: Record<BannerKind, BannerTone> = {
  noConnection: 'error',
  pending: 'warn',
  update: 'info',
};

/** Die Zustandsleiste am Kopf einer Seite: kein Netz, Abgleich oder eine
 * bereitstehende Fassung. Die ganze Fläche ist eine Taste. */
@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
})
export class BannerComponent {
  private readonly i18n = inject(I18nService);

  readonly kind = input<BannerKind>('noConnection');
  readonly icon = input<IconName>('wifi-off');
  readonly actionIcon = input<IconName>();
  readonly actionLabel = input<TranslationKey>();

  readonly actionClick = output();

  protected readonly textKey = computed(() => TEXT[this.kind()]);
  protected readonly tone = computed(() => TONE[this.kind()]);
  protected readonly showsIcon = computed(() => this.kind() !== 'update');

  /** Icon und Beschriftung gehören zusammen: eine Aktion ohne Namen wäre stumm. */
  protected readonly action = computed(() => {
    const icon = this.actionIcon();
    const label = this.actionLabel();
    return icon && label ? { icon, label } : null;
  });

  /** Die Aktion nennt der ganzen Fläche ihren Namen; sonst trägt ihn der Text. */
  protected readonly ariaLabel = computed(() => {
    const action = this.action();
    return action ? this.i18n.translate(action.label) : null;
  });
}
