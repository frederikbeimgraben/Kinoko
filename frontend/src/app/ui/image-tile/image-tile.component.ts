import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ImageCreditComponent } from '../image-credit/image-credit.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';
import type { SpeciesImage } from '../../core/api/models';

/** Eine Bildkachel mit Titelbild-Marke und Herkunftszeile. */
@Component({
  selector: 'app-image-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageCreditComponent, PrivateImageComponent, SvgIconComponent],
  templateUrl: './image-tile.component.html',
  styleUrl: './image-tile.component.scss',
})
export class ImageTileComponent {
  readonly image = input.required<SpeciesImage>();
  /** Zeigt die Marke, wenn dieses Bild das Titelbild der Art ist. */
  readonly lead = input(false);

  protected readonly alt = computed(() => this.image().caption ?? this.image().photographer);
}
