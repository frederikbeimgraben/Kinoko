import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';

/** Der Zustand, den die Leiste meldet. */
export type BannerKind = 'noConnection' | 'pending' | 'update';

/** Das Piktogramm der Leiste. Es gibt nur ein Bild dafür. */
export type BannerIcon = 'offline';

const TEXT: Record<BannerKind, TranslationKey> = {
  noConnection: 'state.noConnection',
  pending: 'state.offlinePending',
  update: 'app.update.ready',
};

/** Die Zustandsleiste am Kopf einer Seite: kein Netz, Abgleich oder eine bereitstehende Fassung. */
@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
})
export class BannerComponent {
  readonly kind = input<BannerKind>('noConnection');
  readonly icon = input<BannerIcon>('offline');
  readonly action = input<TranslationKey>();

  readonly actionClick = output();

  protected readonly textKey = computed(() => TEXT[this.kind()]);
  protected readonly showsIcon = computed(() => this.kind() !== 'update');
}
