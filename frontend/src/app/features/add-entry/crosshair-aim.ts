import { ElementRef, Injectable, inject } from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MAP_ADAPTER } from '../../map/map.tokens';
import type { Location } from './add-entry.store';

/** Moves the map so that `point` is below the centre of `cross`. */
export function panBelow(map: MapLibreMap, cross: Element, point: Location, duration = 300): void {
  const aim = cross.getBoundingClientRect();
  const canvas = map.getCanvas().getBoundingClientRect();
  const shown = map.project([point[0], point[1]]);
  map.panBy(
    [shown.x + canvas.left - (aim.left + aim.width / 2), shown.y + canvas.top - (aim.top + aim.height / 2)],
    { duration },
  );
}

/** The map events before a gesture moves the map. */
const GESTURES = ['mousedown', 'touchstart', 'wheel'] as const;

/** The crosshair of a location step: its point, the start of the step and the way back to that start. */
@Injectable()
export class CrosshairAim {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private start: Location | null = null;
  private release: (() => void) | null = null;

  /** The location below the crosshair, or null without a crosshair. */
  point(): Location | null {
    const cross = this.cross();
    if (cross === null) return null;
    const box = cross.getBoundingClientRect();
    const point = this.adapter.pointAt(box.left + box.width / 2, box.top + box.height / 2);
    return point === null ? null : [point[0], point[1]];
  }

  started(): boolean {
    return this.start !== null;
  }

  /** Keeps the start of the step. An earlier point of the entry moves below the crosshair first.
   * Else the start is the point before the first gesture, because the padding of the map can move the map before. */
  begin(earlier: Location | null): void {
    const map = this.adapter.rawMap();
    const cross = this.cross();
    if (map === null || cross === null) return;
    this.end();
    if (earlier !== null) panBelow(map, cross, earlier);
    this.start = earlier ?? this.point();
    if (earlier !== null) return;
    const first = (): void => {
      this.start = this.point();
      this.stopWatch();
    };
    for (const kind of GESTURES) map.on(kind, first);
    this.release = () => {
      for (const kind of GESTURES) map.off(kind, first);
    };
  }

  end(): void {
    this.stopWatch();
    this.start = null;
  }

  /** The undo of the phone: the map moves back so that the crosshair is on the start of the step. */
  back(): void {
    const map = this.adapter.rawMap();
    const cross = this.cross();
    if (map === null || cross === null || this.start === null) return;
    panBelow(map, cross, this.start);
  }

  private stopWatch(): void {
    this.release?.();
    this.release = null;
  }

  private cross(): Element | null {
    return this.host.nativeElement.querySelector('app-crosshair');
  }
}
