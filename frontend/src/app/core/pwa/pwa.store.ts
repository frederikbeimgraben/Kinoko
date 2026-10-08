import { computed, inject } from '@angular/core';
import { SwUpdate, type VersionEvent, type VersionReadyEvent } from '@angular/service-worker';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { filter, fromEvent, map, merge, pipe, switchMap, tap, timer } from 'rxjs';

/** The event with which a browser offers the installation. */
export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** The offer of the browser. A used offer is gone. */
  prompt: InstallPrompt | null;
  updateReady: boolean;
  /** True in the first seconds after the start. A new version then activates without a question. */
  booting: boolean;
}

const BOOT_WINDOW_MS = 10_000;

function isVersionReady(event: VersionEvent): event is VersionReadyEvent {
  return event.type === 'VERSION_READY';
}

/** The service worker, the install offer and the silent update. */
export const PwaStore = signalStore(
  { providedIn: 'root' },
  withState<PwaState>({ prompt: null, updateReady: false, booting: false }),
  withProps(() => ({
    // Without `provideServiceWorker` the store does nothing and does not fail.
    _swUpdate: inject(SwUpdate, { optional: true }),
  })),
  withComputed(({ prompt }) => ({
    /** True when the browser offers the installation. Firefox on a computer does not. */
    canInstall: computed(() => prompt() !== null),
  })),
  withMethods((store) => {
    /** Activates the waiting version and reloads: silent at the start, else on request. */
    const activate = async (): Promise<void> => {
      if (store._swUpdate === null) return;
      await store._swUpdate.activateUpdate();
      location.reload();
    };

    return {
      activate,

      _followOffers: rxMethod<Window>(
        pipe(
          switchMap((target) =>
            merge(
              fromEvent(target, 'beforeinstallprompt').pipe(
                tap((event) => {
                  event.preventDefault();
                }),
                map((event) => event as InstallPrompt),
              ),
              fromEvent(target, 'appinstalled').pipe(map(() => null)),
            ),
          ),
          tap((prompt) => {
            patchState(store, { prompt });
          }),
        ),
      ),

      _followVersions: rxMethod<SwUpdate>(
        pipe(
          switchMap((swUpdate) => swUpdate.versionUpdates.pipe(filter(isVersionReady))),
          tap(() => {
            patchState(store, { updateReady: true });
            if (store.booting()) void activate();
          }),
        ),
      ),

      _closeBootWindow: rxMethod<number>(
        pipe(
          switchMap((ms) => timer(ms)),
          tap(() => {
            patchState(store, { booting: false });
          }),
        ),
      ),

      _checkWhenVisible: rxMethod<SwUpdate>(
        pipe(
          switchMap((swUpdate) =>
            fromEvent(document, 'visibilitychange').pipe(
              filter(() => document.visibilityState === 'visible'),
              tap(() => {
                void swUpdate.checkForUpdate();
              }),
            ),
          ),
        ),
      ),
    };
  }),
  withMethods((store) => ({
    /** Starts the listeners. Call it once after the first frame. */
    init(): void {
      store._followOffers(window);
      const swUpdate = store._swUpdate;
      if (!swUpdate?.isEnabled) return;
      patchState(store, { booting: true });
      store._closeBootWindow(BOOT_WINDOW_MS);
      store._followVersions(swUpdate);
      store._checkWhenVisible(swUpdate);
    },

    /** Asks the browser. The offer is then used. */
    async install(): Promise<boolean> {
      const offer = store.prompt();
      if (offer === null) return false;
      patchState(store, { prompt: null });
      await offer.prompt();
      return (await offer.userChoice).outcome === 'accepted';
    },
  })),
);

/** The instance type of {@link PwaStore}. */
export type PwaStore = InstanceType<typeof PwaStore>;
