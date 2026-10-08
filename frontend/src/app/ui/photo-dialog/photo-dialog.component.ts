import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { photoPath, type Photo } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Above this horizontal movement in px, a drag is a swipe and not a tremble. */
const SWIPE_THRESHOLD = 60;

/** A photo above the sheet: a dark ground, the image fitted, a close button and arrows. */
@Component({
  selector: 'app-photo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalLayerDirective, PrivateImageComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './photo-dialog.component.html',
  styleUrl: './photo-dialog.component.scss',
})
export class PhotoDialogComponent {
  private readonly i18n = inject(I18nService);

  readonly photos = input.required<readonly Photo[]>();
  readonly index = input(0);

  readonly closed = output();

  /** The index follows the input. An arrow or a swipe sets a new index. */
  protected readonly shown = linkedSignal(() => this.index());

  protected readonly many = computed(() => this.photos().length > 1);

  protected readonly path = computed(() => {
    const photo = this.photos().at(this.shown());
    return photo === undefined ? null : photoPath(photo.id, 'full');
  });

  protected readonly label = computed(() =>
    this.i18n.translate('melden.fotoVorschau', { nummer: this.shown() + 1 }),
  );

  private pointer: number | null = null;
  private startX = 0;

  /** The last photo goes back to the first: the ring has no dead end. */
  protected step(delta: number): void {
    const total = this.photos().length;
    if (total < 2) return;
    this.shown.set((this.shown() + delta + total) % total);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    this.step(delta);
  }

  /** A tap on the photo or a button stays there. Only the ground closes the dialog. */
  protected onGround(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  protected onPointerDown(event: PointerEvent): void {
    this.pointer = event.pointerId;
    this.startX = event.clientX;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointer) return;
    const moved = event.clientX - this.startX;
    this.pointer = null;
    if (Math.abs(moved) < SWIPE_THRESHOLD) return;
    this.step(moved < 0 ? 1 : -1);
  }
}
