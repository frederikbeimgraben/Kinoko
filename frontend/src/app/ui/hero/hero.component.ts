import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Licence } from '../../core/api/models';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { ImageCreditComponent } from '../image-credit/image-credit.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { RippleDirective } from '../ripple/ripple.directive';

/** The photo and its credit that the hero image needs. */
export interface HeroPhoto {
  readonly path: string;
  readonly photographer: string;
  readonly licence: Licence;
}

/** The large image of the species page and the image view: photo, arrows and credit. */
@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, ImageCreditComponent, PrivateImageComponent, RippleDirective, TranslatePipe],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  private readonly i18n = inject(I18nService);

  readonly photo = input<HeroPhoto | null>(null);
  readonly alt = input.required<string>();
  readonly height = input(260);
  /** The position in the stack, counted from one, and the number of images. */
  readonly index = input(0);
  readonly count = input(0);
  /** When false, the arrows do not show, also with more than one image. */
  readonly nav = input(true);
  /** No border and no credit line: the image fills all of its area. */
  readonly bare = input(false);
  /** A tap opens the image. When false, the area does not react. */
  readonly interactive = input(true);

  readonly opened = output();
  readonly prev = output();
  readonly next = output();

  protected readonly path = computed(() => this.photo()?.path ?? '');
  private readonly canStep = computed(() => this.nav() && this.count() > 0);
  protected readonly showPrev = computed(() => this.canStep() && this.index() > 1);
  protected readonly showNext = computed(() => this.canStep() && this.index() < this.count());
  protected readonly showCaption = computed(() => this.photo() !== null && !this.bare());
  protected readonly counter = computed(() =>
    this.i18n.translate('common.counter', { done: this.index(), total: this.count() }),
  );
}
