import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ImageCreditComponent } from '../image-credit/image-credit.component';
import { LevelPillComponent } from '../level-pill/level-pill.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { photoCaption, photoPath, type Photo } from '../../core/api/models';

/** An image tile with a cover badge and a credit line. */
@Component({
  selector: 'app-image-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageCreditComponent, LevelPillComponent, PrivateImageComponent, TranslatePipe],
  templateUrl: './image-tile.component.html',
  styleUrl: './image-tile.component.scss',
})
export class ImageTileComponent {
  private readonly i18n = inject(I18nService);

  readonly image = input.required<Photo>();
  /** Shows the badge when this image is the cover image of the species. */
  readonly lead = input(false);

  protected readonly path = computed(() => photoPath(this.image().id, 'list'));
  protected readonly alt = computed(
    () => photoCaption(this.image(), this.i18n.locale()) ?? this.image().photographer,
  );
}
