import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { AuthService, SessionStore } from '../../core/auth';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { EMPTY_FIND_DRAFT, type FindDraft } from './find-draft';
import type { ObjectValues } from './object-form.component';

/** A point on the map as [longitude, latitude], as in GeoJSON. */
export type Location = readonly [number, number];

/** The steps to add an entry. A find and a marker set one point, then the form. A zone sets its corners. */
export type Step =
  'actions' | 'findLocation' | 'findForm' | 'markerLocation' | 'markerForm' | 'zoneDraw' | 'zoneForm';

/** The minimum number of corners of an area. */
export const CORNERS_MINIMUM = 3;

interface AddEntryStoreState {
  step: Step | null;
  /** The point below the crosshair, after the person accepts it. */
  location: Location | null;
  /** The point before a new location step: the crosshair starts on it, and the undo goes back to it. */
  origin: Location | null;
  /** The corners of the zone, in the sequence of the taps. */
  ring: readonly Location[];
  /** The find form choices while the person sets the location again. */
  findDraft: FindDraft;
  /** The marker or zone form values while the person sets the point or the outline again. */
  objectDraft: ObjectValues | null;
}

const CLEAR: AddEntryStoreState = {
  step: null,
  location: null,
  origin: null,
  ring: [],
  findDraft: EMPTY_FIND_DRAFT,
  objectDraft: null,
};

const FORMS: readonly Step[] = ['findForm', 'markerForm', 'zoneForm'];
const AIMING: readonly Step[] = ['findLocation', 'markerLocation', 'zoneDraw'];

/** The step back from a form to its point or its corners. Other steps end the flow. */
const BACK: Partial<Record<Step, Step>> = {
  findForm: 'findLocation',
  markerForm: 'markerLocation',
  zoneForm: 'zoneDraw',
};

/** The flow behind the add button: only the step and the data. {@link EntriesStore} saves the result. */
export const AddEntryStore = signalStore(
  { providedIn: 'root' },
  withState<AddEntryStoreState>(CLEAR),
  withProps(() => ({
    _stack: inject(OverlayStackService),
    _auth: inject(AuthService),
    _session: inject(SessionStore),
  })),
  withComputed(({ step, ring }) => ({
    running: computed(() => step() !== null),
    /** The map is dark behind the actions and behind the find form. */
    dark: computed(() => step() === 'actions' || step() === 'findForm'),
    /** A form covers the map, so the floating buttons go away. */
    onForm: computed(() => FORMS.some((form) => form === step())),
    onActions: computed(() => step() === 'actions'),
    showsCrosshair: computed(() => AIMING.some((aim) => aim === step())),
    ringClosed: computed(() => ring().length >= CORNERS_MINIMUM),
  })),
  withMethods((store) => {
    const clear = (): void => {
      patchState(store, CLEAR);
    };
    /** The flow adds a step to the history, so the back gesture ends it. */
    const open = (): void => {
      patchState(store, { step: 'actions' });
      store._stack.open(clear);
    };
    return {
      open,
      /** "Eintragen" (board `MapSignIn`): a guest signs in before the form. A known person without network goes on.
       * Gives `false` when the flow did not open. */
      async begin(): Promise<boolean> {
        // A tap before the first answer of the session check waits for it.
        if (store._session.status() === 'unknown') await store._auth.whenChecked();
        if (store._session.status() === 'guest' && !(await store._auth.requestSignIn())) return false;
        open();
        return true;
      },
      startFind(): void {
        patchState(store, { location: null, origin: null, step: 'findLocation', findDraft: EMPTY_FIND_DRAFT });
      },
      /** Goes back from the find form to its location and keeps the choices. Without `keepPoint`, the crosshair aims again. */
      editFindLocation(findDraft: FindDraft, keepPoint: boolean): void {
        patchState(store, (state) => ({
          findDraft,
          step: 'findLocation' as const,
          location: keepPoint ? state.location : null,
          origin: state.location,
        }));
      },
      startMarker(): void {
        patchState(store, { location: null, origin: null, step: 'markerLocation', objectDraft: null });
      },
      startZone(): void {
        patchState(store, { ring: [], step: 'zoneDraw', objectDraft: null });
      },
      /** Goes back from the marker form to its point and keeps the values. The crosshair aims again. */
      editMarkerLocation(objectDraft: ObjectValues): void {
        patchState(store, (state) => ({
          objectDraft,
          step: 'markerLocation' as const,
          location: null,
          origin: state.location,
        }));
      },
      /** Goes back from the zone form to its corners and keeps the values and the corners. */
      editZoneOutline(objectDraft: ObjectValues): void {
        patchState(store, { objectDraft, step: 'zoneDraw' });
      },
      /** Sets the point and stays in the step. The point shows on the map. */
      setPoint(location: Location): void {
        patchState(store, { location });
      },
      /** Takes back the set point. The crosshair then leads again. */
      clearPoint(): void {
        patchState(store, { location: null });
      },
      /** Accepts the point and goes to the form. */
      adoptLocation(location: Location): void {
        patchState(store, (state) => ({
          location,
          step: state.step === 'markerLocation' ? ('markerForm' as const) : ('findForm' as const),
        }));
      },
      addCorner(location: Location): void {
        patchState(store, (state) => ({ ring: [...state.ring, location] }));
      },
      removeLastCorner(): void {
        patchState(store, (state) => ({ ring: state.ring.slice(0, -1) }));
      },
      /** Replaces the ring after Terra Draw moved its corners. */
      setRing(ring: readonly Location[]): void {
        patchState(store, { ring });
      },
      /** Closes the area. Below three corners, there is no area. */
      closeZone(): boolean {
        if (!store.ringClosed()) return false;
        patchState(store, { step: 'zoneForm' });
        return true;
      },
      /** Goes back from the form to the point or to the corners. */
      back(): void {
        patchState(store, (state) => ({ step: state.step === null ? null : (BACK[state.step] ?? null) }));
      },
      stop(): void {
        const wasRunning = store.step() !== null;
        clear();
        if (wasRunning) store._stack.back();
      },
      /** Clears the flow and keeps the history: the tab is already gone. */
      abandon: clear,
    };
  }),
);

/** The instance type of {@link AddEntryStore}. */
export type AddEntryStore = InstanceType<typeof AddEntryStore>;
