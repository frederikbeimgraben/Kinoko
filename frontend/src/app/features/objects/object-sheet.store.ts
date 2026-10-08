import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { MapStore, type ObjectKind } from '../map/map.store';

/** The object over the map, with the way back through the address bar. */
export const ObjectSheetStore = signalStore(
  { providedIn: 'root' },
  /** The form of the object. It is higher than the view, as on the board. */
  withState({ editing: false }),
  withProps(() => {
    const map = inject(MapStore);
    return { _stack: inject(OverlayStackService), _map: map, open: map.object };
  }),
  withMethods((store) => ({
    setEditing(editing: boolean): void {
      patchState(store, { editing });
    },
    /** Opens an object. The back gesture of the browser closes it. */
    show(kind: ObjectKind, id: string): void {
      const first = store._map.object() === null;
      patchState(store, { editing: false });
      store._map.setObject({ kind, id });
      if (first) {
        store._stack.open(() => {
          patchState(store, { editing: false });
          store._map.setObject(null);
        });
      }
    },
    close(): void {
      if (store._map.object() === null) return;
      patchState(store, { editing: false });
      store._map.setObject(null);
      store._stack.back();
    },
  })),
);

/** The instance type of {@link ObjectSheetStore}. */
export type ObjectSheetStore = InstanceType<typeof ObjectSheetStore>;
