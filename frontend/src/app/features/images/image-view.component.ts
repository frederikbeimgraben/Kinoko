import { ChangeDetectionStrategy, Component, computed, inject, input, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { AccountStore } from '../../core/access/account.store';
import { PermissionsStore } from '../../core/access/permissions.store';
import { photoPath } from '../../core/api/models';
import type { PhotoQuery } from '../../core/api/photos.api';
import { longDate } from '../../core/i18n/dates';
import { coarsePlace } from '../../core/i18n/places';
import { COARSE_DIGITS } from '../../core/location/grid';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { HistoryService } from '../../core/navigation/history.service';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { HeroComponent, type HeroPhoto } from '../../ui/hero/hero.component';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { SpeciesDeskComponent } from '../species/species-desk.component';
import { SpeciesStore } from '../species/species.store';
import { ImagesStore } from './images.store';

/** The hero heights of `ImageView.dc.html` and `SpeciesDesktopImage.dc.html`. */
const HERO_PHONE = 300;
const HERO_DESKTOP = 440;

/** The text for an absent value, per the boards. */
const NONE = '–';

/** One photo large with its data, per `ImageView.dc.html`. */
@Component({
  selector: 'app-image-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    HeroComponent,
    ListRowComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SkeletonComponent,
    SpeciesDeskComponent,
    StateViewComponent,
    SwitchComponent,
    TranslatePipe,
  ],
  templateUrl: './image-view.component.html',
  styleUrl: './image-view.component.scss',
})
export class ImageViewComponent {
  private readonly images = inject(ImagesStore);
  private readonly species = inject(SpeciesStore);
  private readonly history = inject(HistoryService);
  private readonly router = inject(Router);
  private readonly rights = inject(PermissionsStore);
  private readonly account = inject(AccountStore);
  private readonly i18n = inject(I18nService);

  readonly slug = input.required<string>();
  readonly id = input.required<string>();

  protected readonly wide = inject(ViewportService).wide;
  protected readonly heroHeight = computed(() => (this.wide() ? HERO_DESKTOP : HERO_PHONE));
  protected readonly title = computed(() => this.species.nameOf(this.slug()) ?? this.slug());
  protected readonly photo = computed(() => this.images.photoOf(this.id()));
  protected readonly index = computed(() => this.images.positionOf(this.id()));
  protected readonly count = computed(() => this.images.photos().length);

  protected readonly hero = computed<HeroPhoto | null>(() => {
    const held = this.photo();
    return held === null
      ? null
      : { path: photoPath(held.id, 'full'), photographer: held.photographer, licence: held.licence };
  });

  protected readonly licence = computed(() => {
    const held = this.photo();
    if (held === null) return '';
    return held.licence === 'own' ? this.i18n.translate(OWN_PHOTO_KEY) : LICENCE_CODE[held.licence];
  });

  protected readonly takenOn = computed(() => {
    const day = this.photo()?.takenOn;
    return day ? longDate(day, this.i18n.locale()) : NONE;
  });

  /** The place stays coarse: a photo must not show the exact spot of a find. */
  protected readonly place = computed(() => {
    const held = this.photo();
    return held?.lat != null && held.lon != null
      ? coarsePlace(held.lat, held.lon, this.i18n.locale(), COARSE_DIGITS)
      : NONE;
  });

  /** Only a person who reviews photos sets the lead photo. */
  protected readonly canSetLead = computed(() => this.rights.can('image.review'));
  protected readonly isLead = computed(() => this.images.lead()?.id === this.id());
  /** A reviewer or the person who submitted the photo may remove it. Without a photo, there is nothing to remove. */
  protected readonly canRemove = computed(() => {
    const photo = this.photo();
    return photo !== null && (this.canSetLead() || this.account.owns(photo.ownerId ?? null));
  });

  private readonly speciesId = computed(() => this.species.entryOf(this.slug())?.id ?? null);

  /** True when the photo is not in the view of the species after the load. */
  protected readonly missing = computed(
    () =>
      this.photo() === null &&
      this.images.query()?.speciesId === this.speciesId() &&
      (this.images.loaded() || this.images.failed()),
  );

  /** The view loads the approved photos of the species one time; a loaded view of the species stays.
   * The query does not read the photos, so that an empty answer does not start a new load. */
  private readonly query = computed<PhotoQuery | null>(() => {
    const speciesId = this.speciesId();
    const held = this.images.query();
    const known =
      held?.speciesId === speciesId && held.state === 'approved' && !untracked(() => this.images.failed());
    return speciesId === null || known ? null : { speciesId, state: 'approved' };
  });

  constructor() {
    void this.species.loadBundle();
    this.images.load(this.query);
  }

  protected back(): void {
    this.history.back(['/arten', this.slug()]);
  }

  /** Goes to the photo before or after this one, in the order of the view. */
  protected step(by: number): void {
    const at = this.index() - 1 + by;
    const next = this.index() === 0 || at < 0 ? undefined : this.images.photos().at(at);
    if (next !== undefined)
      void this.router.navigate(['/arten', this.slug(), 'bilder', next.id], { replaceUrl: true });
  }

  protected async setCover(): Promise<void> {
    if (this.isLead()) return;
    await this.images.setLead(this.id());
  }

  protected async remove(): Promise<void> {
    await this.images.remove(this.id());
    this.back();
  }
}
