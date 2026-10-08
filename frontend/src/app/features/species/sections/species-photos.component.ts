import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { photoPath, type Photo } from '../../../core/api/models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LevelPillComponent } from '../../../ui/level-pill/level-pill.component';
import { PrivateImageComponent } from '../../../ui/private-image/private-image.component';
import { ImagesStore } from '../../images/images.store';
import { SpeciesStore } from '../species.store';

/** One tile in the grid of photos. */
interface Tile {
  id: string;
  path: string;
  alt: string;
  lead: boolean;
}

/** The approved photos of a species as a grid. */
@Component({
  selector: 'app-species-photos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, PrivateImageComponent, TranslatePipe],
  templateUrl: './species-photos.component.html',
  styleUrl: './species-photos.component.scss',
})
export class SpeciesPhotosComponent {
  private readonly images = inject(ImagesStore);
  private readonly species = inject(SpeciesStore);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  protected readonly tiles = computed<readonly Tile[]>(() => {
    const lead = this.images.lead()?.id;
    return this.images.photos().map((one) => ({
      id: one.id,
      path: photoPath(one.id, 'list'),
      alt: this.altOf(one),
      lead: one.id === lead,
    }));
  });

  protected open(id: string): void {
    void this.router.navigate(['/arten', this.slug(), 'bilder', id]);
  }

  private altOf(one: Photo): string {
    return one.caption ?? this.species.nameOf(this.slug()) ?? one.photographer;
  }
}
