import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { photoPath, type Photo } from '../../core/api/models';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';
import { PrivateImageComponent } from '../private-image/private-image.component';

/** Above this horizontal movement in px, a drag is a swipe and not a tremble. */
const SWIPE_THRESHOLD = 60;

/** A photo above the sheet, per the board `MapFindPhoto`: a panel with the image, the close button,
 * the arrows and a line with the day and the position. */
@Component({
  selector: 'app-photo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, ModalLayerDirective, PrivateImageComponent, TranslatePipe],
  templateUrl: './photo-dialog.component.html',
  styleUrl: './photo-dialog.component.scss',
})
export class PhotoDialogComponent {
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly scrim = viewChild<ElementRef<HTMLElement>>('scrim');

  readonly photos = input.required<readonly Photo[]>();
  readonly index = input(0);
  /** The ISO day of the caption, for example the day of the find. Without it the photo gives its day. */
  readonly day = input<string | null>(null);
  /** The scrim leaves the nav bright and the panel centres above it, as the kit `.scrim.top` (board `MapFindPhoto`). */
  readonly stage = input(false);

  readonly closed = output();

  /** The index follows the input. An arrow or a swipe sets a new index. */
  protected readonly shown = linkedSignal(() => this.index());

  protected readonly path = computed(() => {
    const photo = this.photos().at(this.shown());
    return photo === undefined ? null : photoPath(photo.id, 'full');
  });

  protected readonly dayText = computed(() => {
    const photo = this.photos().at(this.shown());
    const day = this.day() ?? photo?.takenOn ?? photo?.createdAt.slice(0, 10);
    return day ? longDate(day, this.i18n.locale()) : '';
  });

  protected readonly counter = computed(() =>
    this.i18n.translate('common.counter', { done: this.shown() + 1, total: this.photos().length }),
  );

  protected readonly hasPrev = computed(() => this.shown() > 0);
  protected readonly hasNext = computed(() => this.shown() < this.photos().length - 1);

  protected readonly label = computed(() =>
    this.i18n.translate('melden.fotoVorschau', { nummer: this.shown() + 1 }),
  );

  private pointer: number | null = null;
  private startX = 0;

  /** The arrows stop at the first and at the last photo, as the counter shows. */
  protected step(delta: number): void {
    const next = this.shown() + delta;
    if (next < 0 || next >= this.photos().length) return;
    this.shown.set(next);
    // The arrow at the end goes away. The focus then stays in the dialog, so Escape still closes it.
    afterNextRender(
      () => {
        const host = this.scrim()?.nativeElement;
        if (host !== undefined && !host.contains(document.activeElement)) host.focus();
      },
      { injector: this.injector },
    );
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
