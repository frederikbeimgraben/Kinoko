import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LICENCE_CODE, LICENCE_URL, OWN_PHOTO_KEY, sourceLink } from './licences';
import type { Licence } from '../../core/api/models';

/** Shows the credit of an image in one line, for example „Foto: Marie Weber · CC BY-SA 4.0“.
 * The licence code links to the licence text. A source with a web address makes the name a link to the source. */
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
  readonly source = input<string | null | undefined>(null);

  protected readonly ownPhotoKey = OWN_PHOTO_KEY;
  protected readonly isOwn = computed(() => this.licence() === 'own');
  protected readonly licenceCode = computed(() => {
    const licence = this.licence();
    return licence === 'own' ? '' : LICENCE_CODE[licence];
  });
  protected readonly licenceUrl = computed(() => LICENCE_URL[this.licence()] ?? null);
  protected readonly sourceUrl = computed(() => sourceLink(this.source()));
}
