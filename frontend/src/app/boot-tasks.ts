import type { EnvironmentInjector } from '@angular/core';
import { SyncService } from './core/offline/sync.service';
import { PwaService } from './core/pwa/pwa.service';
import { SpeciesState } from './features/species/species.state';

/** Service Worker, Warteschlange und Katalog vom Gerät. */
export async function runBootTasks(injector: EnvironmentInjector): Promise<void> {
  injector.get(PwaService).init();
  await Promise.all([injector.get(SyncService).start(), injector.get(SpeciesState).loadBundle()]);
}
