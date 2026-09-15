import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { photoPath, type Photo } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ImageCreditComponent } from '../../ui/image-credit/image-credit.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { SpeciesState } from '../species/species.state';
import { ImagesState } from './images.state';

/** Eine Kachel im Streifen unter dem großen Bild. */
interface Thumb {
  id: string;
  path: string;
  alt: string;
}

/** Die Bilder einer Art: eines groß, die weiteren als Streifen. */
@Component({
  selector: 'app-species-images',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageCreditComponent, PrivateImageComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './species-images.component.html',
  styleUrl: './species-images.component.scss',
})
export class SpeciesImagesComponent {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  protected readonly lead = this.images.lead;

  protected readonly leadPath = computed(() => {
    const lead = this.lead();
    return lead === null ? null : photoPath(lead.id, 'full');
  });

  protected readonly alt = computed(() => this.lead()?.caption ?? this.title());

  protected readonly thumbs = computed<readonly Thumb[]>(() =>
    this.images
      .photos()
      .filter((one) => one.id !== this.lead()?.id)
      .map((one) => ({ id: one.id, path: photoPath(one.id, 'list'), alt: this.altOf(one) })),
  );

  constructor() {
    effect(() => {
      const id = this.species.entryOf(this.slug())?.id;
      if (id !== undefined) this.images.load({ speciesId: id, state: 'approved' });
    });
  }

  protected open(id: string): void {
    void this.router.navigate(['/arten', this.slug(), 'bilder', id]);
  }

  protected add(): void {
    void this.router.navigate(['/arten', this.slug(), 'bilder', 'neu']);
  }

  private title(): string {
    return this.species.nameOf(this.slug()) ?? this.slug();
  }

  private altOf(one: Photo): string {
    return one.caption ?? one.photographer;
  }
}
