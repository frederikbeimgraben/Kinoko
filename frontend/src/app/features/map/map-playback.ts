import { Injectable, inject } from '@angular/core';
import { weekKey } from '../../core/tiles/manifest';
import { MapStore } from './map.store';

/** The week choice of the timeline: a tap or a jump through a deep link. */
@Injectable({ providedIn: 'root' })
export class MapPlayback {
  private readonly state = inject(MapStore);

  select(week: { year: number; week: number }): void {
    this.state.setWeek(weekKey({ year: week.year, week: week.week }));
  }
}
