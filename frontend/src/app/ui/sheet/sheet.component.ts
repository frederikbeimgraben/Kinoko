import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { RippleDirective } from '../ripple/ripple.directive';
import {
  nearestDetent,
  releaseDetent,
  releaseVelocity,
  rubberBand,
  type Detent,
  type DragSample,
} from './sheet-snap';

export type { Detent } from './sheet-snap';

/** A share of the host height from 0 to 1, a fixed height, or `content` for the content height. */
export type DetentSize = number | `${number}px` | 'content';

// A sheet is as high as its content. Only the map sets three different detents.
const DEFAULT_DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

// Above this movement in px, the sheet captures the pointer.
// A tap on a week in the head stays a tap below it.
const GRAB_THRESHOLD = 6;

// Above this horizontal movement in px, the sheet releases the touch.
// The timeline then gets it and scrolls below the finger.
const AXIS_THRESHOLD = 8;

// A drag down below this share of the start height closes a dismissible sheet.
const DISMISS_SHARE = 0.5;

// Below this movement in px, a press on the scrim is a click.
// Above it, the press is a drag on the surface below.
const SCRIM_SLOP = 6;

interface Drag {
  readonly pointer: number;
  readonly startY: number;
  readonly startX: number;
  readonly startHeight: number;
  /** The detent sizes in px, measured once at the start of the drag. */
  sizes: readonly [number, number, number];
  samples: DragSample[];
  moved: boolean;
  captured: boolean;
}

/** A sheet over the map on the phone, a centred modal on the desktop. */
// The grip and each element with `head` drag the sheet. The thumb gets the top edge more easily than a thin strip.
// The height goes to `--pilz-sheet-inset` on the document, so floating buttons stay above the sheet.
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeadComponent, RippleDirective, TranslatePipe],
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
    const targets = this.focusable();
    if (targets.length === 0) return;
    const first = targets[0];
    const last = targets[targets.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && active === last) {
      first.focus();
      event.preventDefault();
    }
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

  private focusable(): HTMLElement[] {
    const chosen =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(chosen));
  }

  private applyInset(): void {
    const height = this.wide() ? 0 : this.sheetHeight();
    document.documentElement.style.setProperty('--pilz-sheet-inset', `${height}px`);
  }
}
