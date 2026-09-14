import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LICENCE_CODE, OWN_PHOTO_KEY } from './licences';
import type { Licence } from '../../core/api/models';

/** Herkunft eines Bildes in einer Zeile: „Foto: Marie Weber · CC BY-SA 4.0“. */
@Component({
  selector: 'app-image-credit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './image-credit.component.html',
  styleUrl: './image-credit.component.scss',
})
export class ImageCreditComponent {
  readonly photographer = input.required<string>();
  readonly licence = input.required<Licence>();

  protected readonly ownPhotoKey = OWN_PHOTO_KEY;
  protected readonly isOwn = computed(() => this.licence() === 'own');
  protected readonly licenceCode = computed(() => {
    const licence = this.licence();
    return licence === 'own' ? '' : LICENCE_CODE[licence];
  });
}
