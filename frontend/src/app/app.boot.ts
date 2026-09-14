import type { EnvironmentInjector } from '@angular/core';

/** Erst wenn der Hauptfaden frei ist, sonst drückt der Start auf die Anzeige. */
const IDLE_TIMEOUT = 1000;

/** Was erst nach dem ersten Bild läuft und den Start nicht aufhält. */
export function bootOffline(injector: EnvironmentInjector): void {
  whenIdle(() => void run(injector));
}

function whenIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: IDLE_TIMEOUT });
  else setTimeout(task, IDLE_TIMEOUT);
}

async function run(injector: EnvironmentInjector): Promise<void> {
  const [{ PwaService }, { SyncService }, { SpeciesState }] = await Promise.all([
    import('./core/pwa/pwa.service'),
    import('./core/offline/sync.service'),
    import('./features/species/species.state'),
  ]);
  injector.get(PwaService).init();
  await Promise.all([injector.get(SyncService).start(), injector.get(SpeciesState).loadBundle()]);
}
