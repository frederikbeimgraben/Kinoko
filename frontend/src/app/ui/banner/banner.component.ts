import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';

/** Der Zustand, den die Leiste meldet. Beide teilen sich die Warnfarbe. */
export type BannerKind = 'noConnection' | 'pending';

/** Das Piktogramm der Leiste. Es gibt nur ein Bild dafür. */
export type BannerIcon = 'offline';

const TEXT: Record<BannerKind, TranslationKey> = {
  noConnection: 'state.noConnection',
  pending: 'state.offlinePending',
};

/**
 * Die Zustandsleiste am Kopf einer Seite. Sie meldet kein Netz oder Abgleich.
 */
@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
})
export class BannerComponent {
  readonly kind = input<BannerKind>('noConnection');
  readonly icon = input<BannerIcon>('offline');

  protected readonly textKey = computed(() => TEXT[this.kind()]);
}
