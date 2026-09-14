import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { BadgeComponent, DialogComponent } from '@stupa-makers/ui-kit';
import { longDate } from '../../core/i18n/dates';
import { COARSE_DIGITS, GRID_KM } from '../../core/location/grid';
import { locationText } from '../../core/i18n/places';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../image-credit/licences';
import { KeyValueRowComponent } from '../key-value-table/key-value-row.component';
import { KeyValueTableComponent } from '../key-value-table/key-value-table.component';
import type { TranslationKey } from '../../core/i18n/translations';
import type { SpeciesImage } from '../../core/api/models';

/** Eine Zeile der Tabelle unter dem grossen Bild. */
interface Detail {
  labelKey: TranslationKey;
  text?: string;
  badgeKey?: TranslationKey;
  badgeText?: string;
}

/** Ein Bild gross, darunter Fotograf, Lizenz, Aufnahmetag und Unterschrift. */
@Component({
  selector: 'app-image-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, DialogComponent, KeyValueRowComponent, KeyValueTableComponent, TranslatePipe],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.scss',
})
export class ImageViewerComponent {
  private readonly i18n = inject(I18nService);

  /** Das Bild. Ohne eines bleibt der Dialog zu. */
  readonly image = input.required<SpeciesImage | null>();
  /** Die Überschrift, meist der Name der Art. */
  readonly title = input.required<string>();

  readonly closed = output();

  protected readonly alt = computed(() => this.image()?.caption ?? this.title());

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
    if (image.takenOn !== null) {
      rows.push({ labelKey: 'image.field.takenOn', text: longDate(image.takenOn, this.i18n.locale()) });
    }
    if (image.source !== null) {
      rows.push({ labelKey: 'image.field.sourcePlaceholder', text: image.source });
    }
    if (image.lat !== null && image.lon !== null) {
      const shown = locationText(image.lat, image.lon, this.i18n.locale(), COARSE_DIGITS);
      rows.push({
        labelKey: 'image.field.place',
        text: `${shown.lat} · ${shown.lon}, ${GRID_KM} km`,
      });
    }
    return rows;
  });
}
