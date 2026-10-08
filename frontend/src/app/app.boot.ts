import type { EnvironmentInjector } from '@angular/core';

/** Wait until the main thread is free. Else the start slows the first render. */
const IDLE_TIMEOUT = 1000;

/** Starts the work that runs after the first render and does not block the start. */
export function bootOffline(injector: EnvironmentInjector): void {
  whenIdle(() => {
    void import('./boot-tasks').then((tasks) => tasks.runBootTasks(injector));
  });
}

function whenIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: IDLE_TIMEOUT });
  else setTimeout(task, IDLE_TIMEOUT);
}
