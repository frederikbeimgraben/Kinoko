import type { EnvironmentInjector } from '@angular/core';

/** Erst wenn der Hauptfaden frei ist, sonst drückt der Start auf die Anzeige. */
const IDLE_TIMEOUT = 1000;

/** Was erst nach dem ersten Bild läuft und den Start nicht aufhält. */
export function bootOffline(injector: EnvironmentInjector): void {
  whenIdle(() => {
    void import('./boot-tasks').then((tasks) => tasks.runBootTasks(injector));
  });
}

function whenIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: IDLE_TIMEOUT });
  else setTimeout(task, IDLE_TIMEOUT);
}
