import type { EnvironmentInjector } from '@angular/core';
import { SyncService } from './core/offline/sync.service';
import { PwaStore } from './core/pwa/pwa.store';
import { SpeciesStore } from './features/species/species.store';

/** The service worker, the queue and the catalogue from the device. */
export async function runBootTasks(injector: EnvironmentInjector): Promise<void> {
  injector.get(PwaStore).init();
  await Promise.all([injector.get(SyncService).start(), injector.get(SpeciesStore).loadBundle()]);
}
