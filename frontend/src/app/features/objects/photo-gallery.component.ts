import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PhotosApi } from '../../core/api/photos.api';
import { photoPath, type Photo } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';

/** Ein Bild der Galerie, fertig für die Vorlage. */
interface Image {
  id: string;
  path: string;
  label: string;
}

/** Die Fotos eines Fundes im Objekt-Blatt. */
@Component({
  selector: 'app-photo-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrivateImageComponent],
  templateUrl: './photo-gallery.component.html',
  styleUrl: './photo-gallery.component.scss',
})
export class PhotoGalleryComponent {
  private readonly api = inject(PhotosApi);
  private readonly i18n = inject(I18nService);

  readonly findId = input.required<string>();

  private readonly held = signal<readonly Photo[]>([]);

  protected readonly images = computed<Image[]>(() =>
    this.held().map((photo, index) => ({
      id: photo.id,
      path: photoPath(photo.id, 'list'),
      label: this.i18n.translate('melden.fotoVorschau', { nummer: index + 1 }),
    })),
  );

  constructor() {
    effect(() => {
      void this.load(this.findId());
    });
  }

  private async load(findId: string): Promise<void> {
    try {
      this.held.set((await firstValueFrom(this.api.list({ findId }))).items);
    } catch {
      // Ein Bild, das nicht kommt, bleibt weg. Der Fund steht auch ohne es.
      this.held.set([]);
    }
  }
}
