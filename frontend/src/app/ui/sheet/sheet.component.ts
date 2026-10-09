import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  ElementRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../action-bar/action-bar.component';
import { OverlayHeadComponent } from '../overlay-head/overlay-head.component';
import {
  nearestDetent,
  releaseDetent,
  releaseVelocity,
  rubberBand,
  type Detent,
  type Drag,
} from './sheet-snap';
import { focusTargets, wrapTarget } from './sheet-focus';

export type { Detent } from './sheet-snap';

/** A share of the host height from 0 to 1, a fixed height, or `content` for the content height. */
export type DetentSize = number | `${number}px` | 'content';

// A sheet is as high as its content. Only the map sets three different detents.
const DEFAULT_DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

// Above this movement in px, the sheet captures the pointer. Below it, a tap on a week stays a tap.
const GRAB_THRESHOLD = 6;

// Above this horizontal movement in px, the sheet releases the touch to the timeline.
const AXIS_THRESHOLD = 8;

// A drag down below this share of the start height closes a dismissible sheet.
const DISMISS_SHARE = 0.5;

// Below this movement in px, a press on the scrim is a click. Above it, it drags the surface below.
const SCRIM_SLOP = 6;

/** A sheet over the map on the phone, a centred modal on the desktop. */
// The grip and each `head` element drag the sheet. `--pilz-sheet-inset` keeps floating buttons above it.
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeadComponent, TranslatePipe],
  templateUrl: './sheet.component.html',
  styleUrl: './sheet.component.scss',
})
export class SheetComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly detent = input<Detent>(1);
  readonly detents = input<readonly [DetentSize, DetentSize, DetentSize]>(DEFAULT_DETENTS);
  /** A sheet that locks the map (report, sign-in) keeps the focus. */
  readonly modal = input(false);
  /** The title in the head. Without a title, the content shows its own. */
  readonly title = input('');
  /** The muted line below the title, for example the coordinates. */
  readonly note = input('');
  /** The close button in the head. The main map sheet has its own head and no close button. */
  readonly closable = input(true);
  /** The back button in the head, for a step inside the sheet. */
  readonly back = input(false);
  /** A line below the head, for example above a filter list. */
  readonly headDivider = input(false);
  /** A modal for few rows: narrower and only as high as its content. */
  readonly compact = input(false);
  /** A sheet that can close also closes on a drag or a fling down. */
  readonly dismissible = input(false);

  readonly detentChange = output<Detent>();
  readonly closed = output();
  readonly backClick = output();
  /** The measured height of the sheet in px, 0 as a modal. */
  readonly heightChange = output<number>();

  private readonly wide = inject(ViewportService).wide;

  /** The switch between sheet and modal is here, never in the caller. */
  protected readonly asModal = this.wide;

  /** Floating actions in the `foot` slot, per `kit.css` `.sheet-over.acts`. */
  private readonly footActions = contentChild(ActionBarComponent, { descendants: false });
  protected readonly hasActions = computed(() => this.footActions() !== undefined);

  protected readonly hasHead = computed(() => this.title() !== '' || this.closable() || this.back());

  /** During a drag, the finger sets the height, not the detent. */
  private readonly dragged = signal<number | null>(null);
  private drag: Drag | null = null;
  private scrim: { pointer: number; x: number; y: number } | null = null;
  private scrimTap = true;

  protected readonly dragging = computed(() => this.dragged() !== null);

  protected readonly height = computed<string | null>(() => {
    if (this.wide()) return null;
    const dragged = this.dragged();
    if (dragged !== null) return `${dragged}px`;
    const size = this.detents()[this.detent()];
    if (size === 'content') return 'auto';
    return typeof size === 'number' ? `${size * 100}%` : size;
  });

  constructor() {
    // Follow each movement, so floating elements stay above the current height, not only above the lowest detent.
    effect(() => {
      this.height();
      this.applyInset();
    });
    // A content sheet changes its height without a new detent, for example when its content loads.
    afterNextRender(() => {
      const sheet = this.host.nativeElement.querySelector('.sheet');
      if (sheet === null || typeof ResizeObserver === 'undefined') return;
      // A projected sheet stays alive after its overlay closes. Its detached node then reports 0 px.
      const observer = new ResizeObserver(() => {
        if (sheet.isConnected) this.applyInset();
      });
      observer.observe(sheet);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
    this.destroyRef.onDestroy(() => document.documentElement.style.removeProperty('--pilz-sheet-inset'));
  }

  protected nextDetent(): void {
    if (this.wide() || this.drag?.moved) return;
    this.detentChange.emit(((this.detent() + 1) % 3) as Detent);
  }

  protected onHandleKey(event: KeyboardEvent): void {
    const step = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const target = Math.min(2, Math.max(0, this.detent() + step)) as Detent;
    if (target !== this.detent()) this.detentChange.emit(target);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.wide()) return;
    // On the grip, the sheet captures the pointer at once: a mouse leaves the thin strip in its first step.
    // In the head, the capture waits for the grab threshold.
    const onHandle = (event.target as HTMLElement).closest('.sheet__handle') !== null;
    if (onHandle) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const startHeight = this.sheetHeight();
    this.drag = {
      pointer: event.pointerId,
      startY: event.clientY,
      startX: event.clientX,
      startHeight,
      sizes: [startHeight, startHeight, startHeight],
      samples: [],
      moved: false,
      captured: onHandle,
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointer !== event.pointerId) return;
    const vertical = Math.abs(drag.startY - event.clientY);
    const horizontal = Math.abs(event.clientX - drag.startX);
    if (!drag.moved) {
      // The first axis decides. A horizontal touch belongs to the timeline, a vertical one to the sheet.
      if (horizontal > vertical && horizontal > AXIS_THRESHOLD) {
        if (drag.captured) (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        this.drag = null;
        return;
      }
      if (vertical <= GRAB_THRESHOLD) return;
      drag.moved = true;
      drag.sizes = this.sizesInPx(drag.startHeight);
      if (!drag.captured) {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        drag.captured = true;
      }
    }
    const finger = Math.max(drag.startHeight + (drag.startY - event.clientY), 0);
    drag.samples = [...drag.samples.slice(-15), { time: event.timeStamp, height: finger }];
    const top = Math.max(...drag.sizes);
    this.dragged.set(Math.min(rubberBand(finger, top), this.hostHeight()));
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointer !== event.pointerId) return;
    const height = this.dragged() ?? drag.startHeight;
    this.dragged.set(null);
    if (drag.moved) this.settle(drag, height, event.timeStamp);
    // The click follows at once. `nextDetent` checks `moved` for this reason.
    setTimeout(() => (this.drag = null));
  }

  /** A press on the scrim is a click only without movement. */
  protected onScrimDown(event: PointerEvent): void {
    this.scrim = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
    this.scrimTap = false;
  }

  protected onScrimUp(event: PointerEvent): void {
    const start = this.scrim;
    this.scrim = null;
    if (start?.pointer !== event.pointerId) return;
    const moved = Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y);
    this.scrimTap = moved <= SCRIM_SLOP;
  }

  protected onScrimClick(): void {
    const tap = this.scrimTap;
    this.scrimTap = true;
    if (tap) this.closed.emit();
  }

  /** Escape closes the modal. In a modal sheet, the tab order stays inside. */
  protected onKey(event: KeyboardEvent): void {
    if (this.asModal() && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    if (!(this.modal() || this.asModal()) || event.key !== 'Tab') return;
    const target = wrapTarget(
      focusTargets(this.host.nativeElement.querySelector('.sheet'), this.asModal()),
      document.activeElement,
      event.shiftKey,
    );
    if (target === null) return;
    target.focus();
    event.preventDefault();
  }

  /** The height before the drag is the measure: a content sheet already has its small height after the drag. */
  private settle(drag: Drag, height: number, now: number): void {
    if (this.dismissible() && height < drag.startHeight * DISMISS_SHARE) {
      this.closed.emit();
      return;
    }
    const velocity = releaseVelocity(drag.samples, now);
    const target = releaseDetent(drag.sizes, this.detent(), height, velocity);
    if (target === null && this.dismissible()) {
      this.closed.emit();
      return;
    }
    const next = target ?? nearestDetent(drag.sizes, this.detent(), height);
    if (next !== this.detent()) this.detentChange.emit(next);
  }

  /** Converts a detent size to px. `content` uses the measured height. */
  private sizeInPx(size: DetentSize, hostHeight: number, measured: number): number {
    if (size === 'content') return measured;
    return typeof size === 'number' ? size * hostHeight : Number.parseFloat(size);
  }

  private hostHeight(): number {
    return this.host.nativeElement.clientHeight || 0;
  }

  private sheetHeight(): number {
    return this.host.nativeElement.querySelector('.sheet')?.clientHeight ?? 0;
  }

  private sizesInPx(measured: number): [number, number, number] {
    const host = this.hostHeight();
    const [a, b, c] = this.detents();
    return [
      this.sizeInPx(a, host, measured),
      this.sizeInPx(b, host, measured),
      this.sizeInPx(c, host, measured),
    ];
  }

  private applyInset(): void {
    if (!this.host.nativeElement.isConnected) return;
    const height = this.wide() ? 0 : this.sheetHeight();
    document.documentElement.style.setProperty('--pilz-sheet-inset', `${height}px`);
    this.heightChange.emit(height);
  }
}
