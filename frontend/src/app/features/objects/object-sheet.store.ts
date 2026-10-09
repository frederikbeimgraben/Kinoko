import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import type { GeoPolygon } from '../../core/api/models';
import type { Location } from '../add-entry/add-entry.store';
import { MapStore, type ObjectKind } from '../map/map.store';

/** The form, the corners of a zone and a new location of a marker or a find. */
interface ObjectSheetState {
  editing: boolean;
  editingCorners: boolean;
  /** The crosshair looks for a new location. The form stays alive below it. */
  relocating: boolean;
  /** The new location from the crosshair. The form saves it with the other fields. */
  moved: Location | null;
  /** The new outline of a zone from the corner step. The form saves it with the other fields. */
  outline: GeoPolygon | null;
}

const FRESH: ObjectSheetState = {
  editing: false,
  editingCorners: false,
  relocating: false,
  moved: null,
  outline: null,
};

/** The object over the map, with the way back through the address bar. */
export const ObjectSheetStore = signalStore(
  { providedIn: 'root' },
  withState<ObjectSheetState>(FRESH),
  withProps(() => {
    const map = inject(MapStore);
    return { _stack: inject(OverlayStackService), _map: map, open: map.object };
  }),
  withMethods((store) => ({
    /** A closed form drops a new location and a new outline that it did not save. */
    setEditing(editing: boolean): void {
      patchState(store, { editing, editingCorners: false, relocating: false, moved: null, outline: null });
    },
    /** Hides the form and shows the crosshair at the object. */
    startRelocating(): void {
      patchState(store, { relocating: true });
    },
    /** Takes the location below the crosshair and shows the form again. */
    relocate(moved: Location): void {
      patchState(store, { relocating: false, moved });
    },
    cancelRelocating(): void {
      patchState(store, { relocating: false });
    },
    /** Hides the zone form and lets the corners move. The form values wait in the zone sheet. */
    startCorners(): void {
      patchState(store, { editing: false, editingCorners: true });
    },
    /** Ends the corner step and shows the form again. A null outline keeps the earlier one. */
    endCorners(outline: GeoPolygon | null): void {
      patchState(store, (state) => ({
        editing: true,
        editingCorners: false,
        outline: outline ?? state.outline,
      }));
    },
    /** Opens an object. The back gesture of the browser closes it. */
    show(kind: ObjectKind, id: string): void {
      const first = store._map.object() === null;
      patchState(store, FRESH);
      store._map.setObject({ kind, id });
      if (first) {
        store._stack.open(() => {
          patchState(store, FRESH);
          store._map.setObject(null);
        });
      }
    },
    close(): void {
      if (store._map.object() === null) return;
      patchState(store, FRESH);
      store._map.setObject(null);
      store._stack.back();
    },
  })),
);

/** The instance type of {@link ObjectSheetStore}. */
export type ObjectSheetStore = InstanceType<typeof ObjectSheetStore>;
