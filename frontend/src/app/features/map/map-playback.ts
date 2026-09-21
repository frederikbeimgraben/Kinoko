import { Injectable, inject } from '@angular/core';
import { weekKey } from '../../core/tiles/manifest';
import { MapState } from './map.state';

/** Die Wochenwahl der Zeitleiste: ein Tipp oder ein Sprung über einen Deep Link. */
@Injectable({ providedIn: 'root' })
export class MapPlayback {
  private readonly state = inject(MapState);

  select(week: { year: number; week: number }): void {
    this.state.week.set(weekKey({ year: week.year, week: week.week }));
  }
}
