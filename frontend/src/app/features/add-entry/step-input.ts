import { Injectable, computed, inject, signal } from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { MAP_ADAPTER } from '../../map/map.tokens';
import type { Location } from './add-entry.store';

/** The source of the point of a step. */
export type StepInputMode = 'crosshair' | 'pointer';

/** A click this near to a set point is a click on the point. */
const HIT_RADIUS = 12;

/** The point of a step: the crosshair on the phone, the pointer on the desktop. A zone takes its corners from taps. */
@Injectable()
export class StepInput {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly viewport = inject(ViewportService);

  private readonly _aim = signal<Location | null>(null);
  private readonly drawing = signal(false);
  private release: (() => void)[] = [];
  private pick: ((point: Location) => void) | null = null;
  private dragging = false;

  /** The point that the next pick gets. */
  readonly aim = this._aim.asReadonly();

  readonly mode = computed<StepInputMode>(() =>
    this.viewport.wide() || this.drawing() ? 'pointer' : 'crosshair',
  );

  /** Listens to the pointer: each click and each drag at `target` calls `pick`. */
  watch(pick: (point: Location) => void, target: () => Location | null = () => null, drawing = false): void {
    this.stop();
    this.drawing.set(drawing);
    this.pick = pick;
    if (this.mode() !== 'pointer') return;
    this.adapter.setCursor('crosshair');
    this.release.push(
      this.adapter.onPointerMove((point) => {
        const at: Location = [point[0], point[1]];
        this._aim.set(at);
        if (this.dragging) this.pick?.(at);
      }),
    );
    this.release.push(
      this.adapter.onMapClick((point) => {
        const set: Location = [point[0], point[1]];
        this._aim.set(set);
        this.pick?.(set);
      }),
    );
    this.release.push(
      this.adapter.onPointerDown((point) => {
        const mark = target();
        if (mark === null || !this.hits(mark, [point[0], point[1]])) return;
        // The drag belongs to the mark. Without the lock, it moves the map.
        this.dragging = true;
        this.adapter.setDragPan(false);
      }),
    );
    this.release.push(
      this.adapter.onPointerUp(() => {
        this.dropMark();
      }),
    );
  }

  /** Releases the mark and gives the pan back to the map. */
  private dropMark(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.adapter.setDragPan(true);
  }

  /** On the phone, the crosshair leads. The host reports its point. */
  aimAt(point: Location | null): void {
    if (this.mode() === 'crosshair') this._aim.set(point);
  }

  /** Forgets the clicked point, so the status names no point. The crosshair of the phone keeps its point. */
  forget(): void {
    if (this.mode() === 'pointer') this._aim.set(null);
  }

  /** Whether a point is near enough to another point to hit it. */
  hits(target: Location, at: Location): boolean {
    const one = this.adapter.project(target);
    const other = this.adapter.project(at);
    if (one === null || other === null) return false;
    return Math.hypot(one.x - other.x, one.y - other.y) <= HIT_RADIUS;
  }

  stop(): void {
    this.dropMark();
    for (const off of this.release) off();
    this.release = [];
    this.pick = null;
    this.adapter.setCursor('');
  }
}
