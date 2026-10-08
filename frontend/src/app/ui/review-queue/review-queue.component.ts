import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RippleDirective } from '../ripple/ripple.directive';

/** From this horizontal distance, a drag is a decision and not a jitter. */
const SWIPE_THRESHOLD = 120;

/** Divides the drag distance to give the tilt angle of the card in degrees. */
const TILT_DIVISOR = 18;

/**
 * A review stack. A swipe to the right accepts. A swipe to the left rejects.
 */
@Component({
  selector: 'app-review-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RippleDirective, TranslatePipe],
  templateUrl: './review-queue.component.html',
  styleUrl: './review-queue.component.scss',
})
export class ReviewQueueComponent<T> {
  readonly items = input.required<readonly T[]>();
  /** Balances the back button of the page to keep the buttons centred. */
  readonly balance = input(false);
  /** The card fills its host and does not use its own height. */
  readonly fill = input(false);
  /** When false, the three round buttons do not show. Use this for an empty card. */
  readonly showActions = input(true);
  readonly card = contentChild.required(TemplateRef);

  readonly accepted = output<T>();
  readonly rejected = output<T>();
  readonly undone = output<T>();

  protected readonly index = signal(0);
  protected readonly dragX = signal(0);
  protected readonly dragging = signal(false);

  protected readonly current = computed<T | undefined>(() => this.items()[this.index()]);
  protected readonly behind = computed<T | undefined>(() => this.items()[this.index() + 1]);
  protected readonly canUndo = computed(() => this.index() > 0);
  protected readonly tilt = computed(
    () => `translateX(${this.dragX()}px) rotate(${this.dragX() / TILT_DIVISOR}deg)`,
  );

  private pointerId: number | null = null;
  private startX = 0;

  protected onPointerDown(event: PointerEvent): void {
    if (this.current() === undefined) return;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging() || event.pointerId !== this.pointerId) return;
    this.dragX.set(event.clientX - this.startX);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.dragging() || event.pointerId !== this.pointerId) return;
    const dx = this.dragX();
    this.endDrag();
    if (dx > SWIPE_THRESHOLD) this.accept();
    else if (dx < -SWIPE_THRESHOLD) this.reject();
  }

  protected onPointerCancel(): void {
    this.endDrag();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.accept();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.reject();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.undo();
    }
  }

  protected accept(): void {
    const item = this.current();
    if (item === undefined) return;
    this.index.update((i) => i + 1);
    this.accepted.emit(item);
  }

  protected reject(): void {
    const item = this.current();
    if (item === undefined) return;
    this.index.update((i) => i + 1);
    this.rejected.emit(item);
  }

  protected undo(): void {
    if (!this.canUndo()) return;
    this.index.update((i) => i - 1);
    const item = this.items()[this.index()];
    this.undone.emit(item);
  }

  private endDrag(): void {
    this.dragging.set(false);
    this.dragX.set(0);
    this.pointerId = null;
  }
}
