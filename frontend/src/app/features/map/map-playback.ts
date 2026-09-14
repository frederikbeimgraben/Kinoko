import { Injectable, inject, signal } from '@angular/core';
import { weekKey } from '../../core/tiles/manifest';
import { VisibilityService } from '../../core/visibility/visibility.service';
import { MapState } from './map.state';
import { MapView } from './map.view';

/** Takt der Wiedergabe. 700 ms sind langsam genug, um eine Woche zu erkennen. */
const BEAT = 700;

/** Die Wochenwahl: ein Schritt, ein Sprung oder die Wiedergabe. */
@Injectable({ providedIn: 'root' })
export class MapPlayback {
  private readonly state = inject(MapState);
  private readonly view = inject(MapView);
  private readonly visibility = inject(VisibilityService);

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly _playing = signal(false);
  readonly playing = this._playing.asReadonly();

  select(week: { year: number; week: number }): void {
    this.stop();
    this.state.week.set(weekKey({ year: week.year, week: week.week }));
  }

  /** Eine Woche vor oder zurück, ohne über die Enden hinaus. */
  step(direction: 1 | -1): void {
    const manifest = this.view.manifest();
    const week = this.view.week();
    if (manifest === null || week === null) return;
    const at = manifest.weeks.indexOf(week);
    const target = Math.min(manifest.weeks.length - 1, Math.max(0, at + direction));
    const next = manifest.weeks[target];
    if (target !== at) this.select({ year: next.year, week: next.week });
  }

  toggle(): void {
    if (this._playing()) {
      this.stop();
      return;
    }
    this._playing.set(true);
    this.timer = setInterval(() => {
      this.beat();
    }, BEAT);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this._playing.set(false);
  }

  private beat(): void {
    const manifest = this.view.manifest();
    const week = this.view.week();
    if (!this.visibility.visible() || manifest === null || week === null) {
      this.stop();
      return;
    }
    const next = manifest.weeks.indexOf(week) + 1;
    if (next >= manifest.weeks.length) {
      this.stop();
      return;
    }
    this.state.week.set(weekKey(manifest.weeks[next]));
  }
}
