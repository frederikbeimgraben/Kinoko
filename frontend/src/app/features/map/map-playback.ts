import { Injectable, inject } from '@angular/core';
import { weekKey } from '../../core/tiles/manifest';
import { MapStore } from './map.store';

/** Die Wochenwahl der Zeitleiste: ein Tipp oder ein Sprung über einen Deep Link. */
@Injectable({ providedIn: 'root' })
export class MapPlayback {
  private readonly state = inject(MapStore);

  select(week: { year: number; week: number }): void {
    this.state.setWeek(weekKey({ year: week.year, week: week.week }));
  }
}
