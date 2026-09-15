import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { photoPath, type Photo } from '../../../core/api/models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PrivateImageComponent } from '../../../ui/private-image/private-image.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import { ImagesState } from '../../images/images.state';
import { SpeciesState } from '../species.state';

/** Eine Kachel im Raster der Bilder. */
interface Tile {
  id: string;
  path: string;
  alt: string;
}

/** Die freigegebenen Bilder einer Art als Raster. */
@Component({
  selector: 'app-species-photos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrivateImageComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './species-photos.component.html',
  styleUrl: './species-photos.component.scss',
})
export class SpeciesPhotosComponent {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  /** Ohne Konto geht keine Einreichung hinaus: die Kachel bleibt dann weg. */
  protected readonly canAdd = this.auth.signedIn;

  protected readonly tiles = computed<readonly Tile[]>(() =>
    this.images.photos().map((one) => ({
      id: one.id,
      path: photoPath(one.id, 'list'),
      alt: this.altOf(one),
    })),
  );

  protected open(id: string): void {
    void this.router.navigate(['/arten', this.slug(), 'bilder', id]);
  }

  protected add(): void {
    void this.router.navigate(['/arten', this.slug(), 'bilder', 'neu']);
  }

  private altOf(one: Photo): string {
    return one.caption ?? this.species.nameOf(this.slug()) ?? one.photographer;
  }
}
