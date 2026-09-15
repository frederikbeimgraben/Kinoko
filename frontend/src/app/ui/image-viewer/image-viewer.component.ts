import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import { longDate } from '../../core/i18n/dates';
import { COARSE_DIGITS } from '../../core/location/grid';
import { coarsePlace } from '../../core/i18n/places';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../image-credit/licences';
import { ListRowComponent } from '../list-row/list-row.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import type { TranslationKey } from '../../core/i18n/translations';
import { photoPath, type Photo } from '../../core/api/models';

/** Eine Zeile der Tabelle unter dem grossen Bild. */
interface Detail {
  labelKey: TranslationKey;
  text?: string;
  badgeKey?: TranslationKey;
  badgeText?: string;
}

/** Die Bildansicht als Seite: Kopf, Bild gross, darunter seine Angaben. */
@Component({
  selector: 'app-image-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ListRowComponent, PageHeaderComponent, PrivateImageComponent, TranslatePipe],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.scss',
})
export class ImageViewerComponent {
  private readonly i18n = inject(I18nService);

  /** Das Bild. Ohne eines bleibt die Seite leer. */
  readonly image = input.required<Photo | null>();
  /** Die Überschrift, meist der Name der Art. */
  readonly title = input.required<string>();
  /** Das wievielte Bild von wie vielen. Ohne Anzahl steht kein Zähler da. */
  readonly index = input(0);
  readonly count = input(0);

  readonly back = output();

  protected readonly alt = computed(() => this.image()?.caption ?? this.title());

  protected readonly path = computed(() => {
    const image = this.image();
    return image === null ? null : photoPath(image.id, 'full');
  });

  protected readonly counter = computed(() =>
    this.i18n.translate('common.counter', { done: this.index(), total: this.count() }),
  );

  protected readonly details = computed<readonly Detail[]>(() => {
    const image = this.image();
    if (image === null) return [];
    const licence = image.licence;
    const rows: Detail[] = [
      { labelKey: 'image.field.photo', text: image.photographer },
      licence === 'own'
        ? { labelKey: 'image.field.licence', badgeKey: OWN_PHOTO_KEY }
        : { labelKey: 'image.field.licence', badgeText: LICENCE_CODE[licence] },
    ];
    const source = image.source ?? null;
    if (source !== null) {
      rows.push({ labelKey: 'image.field.sourcePlaceholder', text: source });
    }
    const takenOn = image.takenOn ?? null;
    if (takenOn !== null) {
      rows.push({ labelKey: 'image.field.takenOn', text: longDate(takenOn, this.i18n.locale()) });
    }
    const lat = image.lat ?? null;
    const lon = image.lon ?? null;
    if (lat !== null && lon !== null) {
      const place = coarsePlace(lat, lon, this.i18n.locale(), COARSE_DIGITS);
      rows.push({ labelKey: 'image.field.place', text: place });
    }
    return rows;
  });
}
