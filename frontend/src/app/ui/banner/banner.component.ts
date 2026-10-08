import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';
import { RippleDirective } from '../ripple/ripple.directive';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';

/** The state that the banner reports. */
export type BannerKind = 'noConnection' | 'pending' | 'update';

/** The tone of each state, per `kit.css` `.banner`, `.banner.error` and `.banner.info`. */
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

const ICON: Record<BannerKind, IconName> = {
  noConnection: 'wifi-off',
  pending: 'upload',
  update: 'check',
};

/** The state banner per `Banner.dc.html`: no connection, pending transfers or a new version. It is one button. */
@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
  host: { '[class.banner-host--float]': 'float()' },
})
export class BannerComponent {
  private readonly i18n = inject(I18nService);

  readonly kind = input<BannerKind>('noConnection');
  /** A translated text. Without it, the banner shows the text of its kind. */
  readonly text = input<string>();
  /** Without it, the banner shows the icon of its kind. */
  readonly icon = input<IconName>();
  /** A count in the `.cnt` pill, for example the number of pending transfers. */
  readonly count = input<string | number>();
  /** Without a value, the chevron shows only when the banner has no action icon. */
  readonly chev = input<boolean>();
  /** The banner floats over the map, per `.banner.float`. */
  readonly float = input(false);
  readonly actionIcon = input<IconName>();
  readonly actionLabel = input<TranslationKey>();

  readonly actionClick = output();

  protected readonly textKey = computed(() => TEXT[this.kind()]);
  protected readonly tone = computed(() => TONE[this.kind()]);
  protected readonly glyph = computed(() => this.icon() ?? ICON[this.kind()]);
  protected readonly countText = computed(() => {
    const count = this.count();
    return count === undefined || count === '' ? null : String(count);
  });

  /** The icon and the label go together: an action without a name is silent. */
  protected readonly action = computed(() => {
    const icon = this.actionIcon();
    const label = this.actionLabel();
    return icon && label ? { icon, label } : null;
  });

  protected readonly showsChev = computed(() => this.chev() ?? this.action() === null);

  /** The action gives its name to the full area. Without an action, the text is the name. */
  protected readonly ariaLabel = computed(() => {
    const action = this.action();
    return action ? this.i18n.translate(action.label) : null;
  });
}
