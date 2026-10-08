import type { Provider } from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Location } from '../features/add-entry/add-entry.store';
import { ZONE_DRAWER, type RingListener, type DrawSession } from '../features/add-entry/zone-drawer';

/** Terra Draw without a map: the session records what it had to draw. */
export class DrawerDouble implements DrawSession {
  readonly rings: (readonly Location[])[] = [];
  stopped = 0;
  private handler: RingListener | null = null;

  showRing(ring: readonly Location[]): void {
    this.rings.push(ring);
  }

  edit(handler: RingListener): void {
    this.handler = handler;
  }

  stop(): void {
    this.stopped += 1;
  }

  /** Simulates a corner that a finger moved. */
  drag(ring: Location[]): void {
    this.handler?.(ring);
  }
}

/** Puts the double in the place of Terra Draw. */
export function drawerProviders(double: DrawerDouble): Provider[] {
  return [{ provide: ZONE_DRAWER, useValue: () => Promise.resolve(double) }];
}

/** A map that must only exist, so the drawer starts. */
export function rawMap(): MapLibreMap {
  return {} as MapLibreMap;
}
