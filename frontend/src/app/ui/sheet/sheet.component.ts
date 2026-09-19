import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Die drei Rasten des Blatts, von unten nach oben. */
export type Detent = 0 | 1 | 2;

/** Anteil der Wirtshöhe zwischen 0 und 1, feste Höhe oder `content` für die Inhaltshöhe. */
export type DetentSize = number | `${number}px` | 'content';

/** Die Art des Blatts. Ein `step` lässt am Rechner die Karte frei. */
export type SheetKind = 'sheet' | 'step';

// Die unterste Raste ist --size-sheet-head, 152 Pixel. Die Zug-Physik
// braucht die Zahl vor dem Zeichnen des Blatts.
const DEFAULT_DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['152px', 0.4, 0.9];

// Erst ab dieser Bewegung in Punkten zählt ein Zug als Zug, nicht als Tipp.
const DRAG_THRESHOLD = 24;

// Ab dieser Bewegung greift das Blatt den Zeiger ab. Ein Tipp auf eine
// Woche im Kopf bleibt darunter trotzdem ein Tipp.
const GRAB_THRESHOLD = 6;

// Ab dieser waagrechten Bewegung lässt das Blatt die Berührung los.
// Die Zeitleiste übernimmt sie und scrollt unter dem Finger.
const AXIS_THRESHOLD = 8;

// Unter diesem Anteil der untersten Raste schließt ein Zug nach unten.
const DISMISS_SHARE = 0.5;

// Unter dieser Bewegung in Punkten zählt ein Druck auf die Abdunkelung als
// Klick. Darüber ist es ein Zug auf der Fläche darunter.
const SCRIM_SLOP = 6;

interface Drag {
  readonly pointer: number;
  readonly startY: number;
  readonly startX: number;
  readonly startHeight: number;
  moved: boolean;
  captured: boolean;
}

/** Blatt über der Karte am Telefon, zentriertes Modal am Rechner. */
// Der Griff und alles mit `head` ziehen das Blatt. Die obere Kante
// trifft der Daumen leichter als ein schmaler Streifen.

// Die Höhe steht als `--pilz-sheet-inset` am Dokument. Schwebende Knöpfe
// und die Kartenzuschreibung bleiben so darüber.
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './sheet.component.html',
  styleUrl: './sheet.component.scss',
})
export class SheetComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly detent = input<Detent>(1);
  readonly detents = input<readonly [DetentSize, DetentSize, DetentSize]>(DEFAULT_DETENTS);
  /** Ein Blatt, das die Karte sperrt (Melden, Anmelden), fängt den Fokus. */
  readonly modal = input(false);
  /** Der Kopf des Modals am Rechner. Ohne Titel trägt der Inhalt ihn selbst. */
  readonly title = input('');
  /** Der gedämpfte Zusatz neben dem Titel, etwa die Koordinaten. */
  readonly note = input('');
  /** Ein Modal für wenige Zeilen: schmaler und nur so hoch wie sein Inhalt. */
  readonly compact = input(false);
  /** Ein Blatt, das sich schließen lässt, geht auch mit einem Zug nach unten zu. */
  readonly dismissible = input(false);
  /** Ein Schritt auf der Karte dockt am Rechner an, statt die Karte zu sperren. */
  readonly kind = input<SheetKind>('sheet');

  readonly detentChange = output<Detent>();
  readonly closed = output();

  private readonly wide = inject(ViewportService).wide;

  /** Der Wechsel zwischen Blatt und Modal liegt hier, nie in der Instanz. */
  protected readonly asModal = computed(() => this.wide() && this.kind() === 'sheet');
  /** Am Rechner dockt ein Schritt an: kein Modal, keine Abdunkelung. */
  protected readonly asStep = computed(() => this.wide() && this.kind() === 'step');

  /** Während eines Zugs führt der Finger, nicht die Raste. */
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
    // Folgt jeder Bewegung. Schwebende Elemente bleiben so über der
    // aktuellen Blatthöhe, nicht nur über der untersten Raste.
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
    // Am Griff greift das Blatt den Zeiger sofort ab: eine Maus verlässt den
    // Streifen schon im ersten Schritt. Im Kopf bleibt er beim Ziel darunter.
    const onHandle = (event.target as HTMLElement).closest('.sheet__handle') !== null;
    if (onHandle) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = {
      pointer: event.pointerId,
      startY: event.clientY,
      startX: event.clientX,
      startHeight: this.sheetHeight(),
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
      // Die erste Achse entscheidet. Waagrecht gehört die Berührung der
      // Zeitleiste, senkrecht gehört sie dem Blatt.
      if (horizontal > vertical && horizontal > AXIS_THRESHOLD) {
        if (drag.captured) (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        this.drag = null;
        return;
      }
      if (vertical <= GRAB_THRESHOLD) return;
      drag.moved = true;
      if (!drag.captured) {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        drag.captured = true;
      }
    }
    const next = drag.startHeight + (drag.startY - event.clientY);
    this.dragged.set(Math.min(Math.max(next, 0), this.hostHeight()));
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointer !== event.pointerId) return;
    const height = this.dragged() ?? drag.startHeight;
    this.dragged.set(null);
    if (drag.moved) {
      const sizes = this.sizesInPx();
      if (this.dismissible() && height < sizes[0] * DISMISS_SHARE) {
        this.closed.emit();
        setTimeout(() => (this.drag = null));
        return;
      }
      const target = this.nearestDetent(sizes, this.detent(), height);
      if (target !== this.detent()) this.detentChange.emit(target);
    }
    // Der Klick folgt gleich danach. `nextDetent` prüft darum noch `moved`.
    setTimeout(() => (this.drag = null));
  }

  /** Ein Druck auf die Abdunkelung zählt nur ohne Bewegung als Klick. */
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

  /** Escape schließt das Modal. Im modalen Blatt bleibt der Tabulator darin. */
  protected onKey(event: KeyboardEvent): void {
    if ((this.asModal() || this.asStep()) && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    if (this.asStep() || !(this.modal() || this.asModal()) || event.key !== 'Tab') return;
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

  /** Die nächstgelegene Raste zur Höhe. Unter der Schwelle bleibt die alte. */
  private nearestDetent(sizes: readonly [number, number, number], current: Detent, height: number): Detent {
    if (Math.abs(height - sizes[current]) < DRAG_THRESHOLD) return current;
    let best: Detent = current;
    for (const candidate of [0, 1, 2] as const) {
      if (Math.abs(sizes[candidate] - height) < Math.abs(sizes[best] - height)) best = candidate;
    }
    return best;
  }

  /** Rechnet ein Rastenmaß in Punkte um. `content` nimmt die gemessene Höhe. */
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

  private sizesInPx(): [number, number, number] {
    const host = this.hostHeight();
    const measured = this.sheetHeight();
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
