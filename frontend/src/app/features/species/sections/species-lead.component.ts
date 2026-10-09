import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { photoCaption, photoPath } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { PhotoQuery } from '../../../core/api/photos.api';
import { HeroComponent, type HeroPhoto } from '../../../ui/hero/hero.component';
import { ImagesStore } from '../../images/images.store';
import { SpeciesStore } from '../species.store';

/** The lead photo of the species at the top of the page. */
@Component({
  selector: 'app-species-lead',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroComponent],
  templateUrl: './species-lead.component.html',
  styleUrl: './species-lead.component.scss',
})
export class SpeciesLeadComponent {
  private readonly images = inject(ImagesStore);
  private readonly species = inject(SpeciesStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly slug = input.required<string>();
  /** The hero height: 260 px on the phone, 210 px in a desktop column. */
  readonly height = input(260);

  protected readonly lead = this.images.lead;

  protected readonly photo = computed<HeroPhoto | null>(() => {
    const held = this.lead();
    if (held === null) return null;
    return {
      path: photoPath(held.id, 'full'),
      photographer: held.photographer,
      licence: held.licence,
      source: held.source,
    };
  });

  /** The position of the lead photo in the view, from one, for the counter of the hero. */
  protected readonly index = computed(() => {
    const held = this.lead();
    return held === null ? 0 : this.images.positionOf(held.id);
  });
  protected readonly count = computed(() => this.images.photos().length);

  protected readonly alt = computed(() => {
    const held = this.lead();
    const caption = held === null ? null : photoCaption(held, this.i18n.locale());
    return caption ?? this.species.nameOf(this.slug()) ?? this.slug();
  });

  private readonly query = computed<PhotoQuery | null>(() => {
    const id = this.species.entryOf(this.slug())?.id;
    return id === undefined ? null : { speciesId: id, state: 'approved' };
  });

  constructor() {
    this.images.load(this.query);
  }

  protected open(): void {
    const held = this.lead();
    if (held === null) return;
    void this.router.navigate(['/arten', this.slug(), 'bilder', held.id]);
  }

  /** The arrows of the hero open the photo before or after the lead photo. */
  protected step(by: number): void {
    const at = this.index() - 1 + by;
    const next = this.index() > 0 && at >= 0 ? this.images.photos().at(at) : undefined;
    if (next !== undefined) {
      void this.router.navigate(['/arten', this.slug(), 'bilder', next.id]);
    }
  }
}
