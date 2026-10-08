import { InjectionToken, type Provider } from '@angular/core';
import { MapLibreAdapter, type MapAdapter } from './map-adapter';
import { createWorker } from './value-worker';
import type { ColorizeWorker } from './value-protocol';

/** The map adapter. Tests use a double without WebGL. */
export const MAP_ADAPTER = new InjectionToken<MapAdapter>('KarteAdapter');

/** Makes the colorize worker. Tests use a double without a real thread. */
export const VALUE_WORKER = new InjectionToken<() => ColorizeWorker>('WertArbeiter');

/**
 * Loads MapLibre only when the map opens. Thus it stays in its own chunk and not in the first bundle.
 */
export const MAP_PROVIDERS: Provider[] = [
  { provide: MAP_ADAPTER, useFactory: () => new MapLibreAdapter(() => import('maplibre-gl')) },
  { provide: VALUE_WORKER, useValue: createWorker },
];
