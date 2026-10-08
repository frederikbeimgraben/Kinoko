import type { EnvironmentInjector } from '@angular/core';
import { SyncStore } from './core/offline/sync.store';
import { PwaStore } from './core/pwa/pwa.store';
import { SpeciesStore } from './features/species/species.store';

/** The service worker, the queue and the catalogue from the device. */
export async function runBootTasks(injector: EnvironmentInjector): Promise<void> {
  injector.get(PwaStore).init();
  await Promise.all([injector.get(SyncStore).start(), injector.get(SpeciesStore).loadBundle()]);
}
