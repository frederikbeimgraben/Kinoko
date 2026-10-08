import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { AuthService } from '../../core/auth';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import type { Layer } from '../../core/tiles/layers';
import { CombinationStore } from './combination.store';
import type { Factor } from './factors';
import { MapSurface } from './map-surface';
import type { Overlay } from './map-overlays.component';
import { MapView } from './map.view';

/** The sheet over the map, with the way back through the address bar. The map component provides it. */
export const MapOverlayStore = signalStore(
  withState<{ overlay: Overlay }>({ overlay: null }),
  withProps(() => ({
    _stack: inject(OverlayStackService),
    _auth: inject(AuthService),
    _view: inject(MapView),
    _combination: inject(CombinationStore),
    _surface: inject(MapSurface),
  })),
  withMethods((store) => {
    const dismiss = (): void => {
      patchState(store, { overlay: null });
      store._surface.inProgress.set(null);
    };
    /** Opens a sheet. The first sheet over the map adds a step to the history. */
    const set = (next: Overlay): void => {
      const opening = store.overlay() === null && next !== null;
      patchState(store, { overlay: next });
      if (opening) store._stack.open(dismiss);
    };
    const close = (): void => {
      const wasOpen = store.overlay() !== null;
      dismiss();
      if (wasOpen) store._stack.back();
    };
    return {
      set,
      close,
      /** The title in the head opens the choice of the current view. */
      openTitle(): void {
        set(store._view.onLayer() ? 'layer' : 'species');
      },
      openFactorFor(source: string): void {
        const factor = store._combination.factors().find((entry) => entry.source === source) ?? null;
        store._surface.inProgress.set(factor);
        set('factor');
      },
      chooseSource(layer: Layer): void {
        store._surface.inProgress.set(store._combination.start(layer.id, layer.low, layer.high));
        set('factor');
      },
      applyFactor(factor: Factor): void {
        store._combination.apply(factor);
        close();
      },
      removeFactor(factor: Factor): void {
        store._combination.remove(factor);
        close();
      },
      /** Without an account, the button goes to the sign-in first. */
      async requestSave(): Promise<void> {
        if (await store._auth.requestSignIn()) set('save');
      },
    };
  }),
);

/** The instance type of {@link MapOverlayStore}. */
export type MapOverlayStore = InstanceType<typeof MapOverlayStore>;
