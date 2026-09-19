import { Injectable, computed, inject, signal } from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { MAP_ADAPTER } from '../../map/map.tokens';
import type { Location } from './add-entry.state';

/** Woher der Ort eines Schritts kommt. */
export type StepInputMode = 'crosshair' | 'pointer';

/** So nah am gesetzten Punkt zählt ein Klick als Klick auf den Punkt. */
const HIT_RADIUS = 12;

/** Der Ort, den ein Schritt meint: Fadenkreuz am Telefon, Zeiger am Rechner. */
@Injectable()
export class StepInput {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly viewport = inject(ViewportService);

  private readonly _aim = signal<Location | null>(null);
  private release: (() => void)[] = [];
  private pick: ((point: Location) => void) | null = null;

  /** Der Ort, den der nächste Punkt bekäme. */
  readonly aim = this._aim.asReadonly();

  readonly mode = computed<StepInputMode>(() => (this.viewport.wide() ? 'pointer' : 'crosshair'));

  /** Nimmt den Zeiger auf. Der Ruf kommt bei jedem Klick auf die Karte. */
  watch(pick: (point: Location) => void): void {
    this.stop();
    this.pick = pick;
    if (this.mode() !== 'pointer') return;
    this.adapter.setCursor('crosshair');
    this.release.push(
      this.adapter.onPointerMove((point) => {
        this._aim.set([point[0], point[1]]);
      }),
    );
    this.release.push(
      this.adapter.onMapClick((point) => {
        const set: Location = [point[0], point[1]];
        this._aim.set(set);
        this.pick?.(set);
      }),
    );
  }

  /** Am Telefon führt das Fadenkreuz. Der Wirt meldet seinen Ort. */
  aimAt(point: Location | null): void {
    if (this.mode() === 'crosshair') this._aim.set(point);
  }

  /** Ob ein Ort nah genug an einem anderen liegt, um ihn zu treffen. */
  hits(target: Location, at: Location): boolean {
    const one = this.adapter.project(target);
    const other = this.adapter.project(at);
    if (one === null || other === null) return false;
    return Math.hypot(one.x - other.x, one.y - other.y) <= HIT_RADIUS;
  }

  stop(): void {
    for (const off of this.release) off();
    this.release = [];
    this.pick = null;
    this.adapter.setCursor('');
  }
}
