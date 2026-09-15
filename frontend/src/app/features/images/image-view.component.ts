import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import { photoPath } from '../../core/api/models';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { locationText } from '../../core/i18n/places';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { COARSE_DIGITS, GRID_KM } from '../../core/location/grid';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { KeyValueRowComponent } from '../../ui/key-value-table/key-value-row.component';
import { KeyValueTableComponent } from '../../ui/key-value-table/key-value-table.component';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { SpeciesState } from '../species/species.state';
import { ImagesState } from './images.state';

/** Ein Bild groß, seine Angaben und die beiden Wege am Fuß. */
@Component({
  selector: 'app-image-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    TranslatePipe,
  ],
  templateUrl: './image-view.component.html',
  styleUrl: './image-view.component.scss',
})
export class ImageViewComponent {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();
  readonly id = input.required<string>();

  protected readonly title = computed(() => this.species.nameOf(this.slug()) ?? this.slug());
  protected readonly photo = computed(() => this.images.photoOf(this.id()));
  protected readonly path = computed(() => photoPath(this.id(), 'full'));
  protected readonly alt = computed(() => this.photo()?.caption ?? this.title());

  protected readonly counter = computed(() =>
    this.i18n.translate('common.counter', {
      done: this.images.positionOf(this.id()),
      total: this.images.photos().length,
    }),
  );

  protected readonly licenceCode = computed(() => {
    const licence = this.photo()?.licence;
    return licence === undefined || licence === 'own' ? null : LICENCE_CODE[licence];
  });
  protected readonly ownPhotoKey = OWN_PHOTO_KEY;

  protected readonly takenOn = computed(() => {
    const day = this.photo()?.takenOn;
    return day ? longDate(day, this.i18n.locale()) : null;
  });

  protected readonly place = computed(() => {
    const one = this.photo();
    if (one?.lat == null || one.lon == null) return null;
    const shown = locationText(one.lat, one.lon, this.i18n.locale(), COARSE_DIGITS);
    return `${shown.lat} · ${shown.lon}, ${GRID_KM} km`;
  });

  constructor() {
    void this.species.loadBundle();
    effect(() => {
      const speciesId = this.species.entryOf(this.slug())?.id;
      if (speciesId !== undefined && this.images.photos().length === 0) {
        this.images.load({ speciesId, state: 'approved' });
      }
    });
  }

  protected back(): void {
    void this.router.navigate(['/arten', this.slug()]);
  }

  protected async setCover(): Promise<void> {
    await this.images.setLead(this.id());
  }

  protected async remove(): Promise<void> {
    await this.images.remove(this.id());
    this.back();
  }
}
