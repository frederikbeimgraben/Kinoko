import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';

/** A point on the map as [longitude, latitude], as in GeoJSON. */
export type Location = readonly [number, number];

/**
 * The steps to add an entry. A find and a marker use the same path: first the point
 * below the crosshair, then the form. A zone sets its corners instead of one point.
 */
export type Step =
  'actions' | 'findLocation' | 'findForm' | 'markerLocation' | 'markerForm' | 'zoneDraw' | 'zoneForm';

/** The minimum number of corners of an area. */
export const CORNERS_MINIMUM = 3;

interface AddEntryStoreState {
  step: Step | null;
  /** The point below the crosshair, after the person accepts it. */
  location: Location | null;
  /** The corners of the zone, in the sequence of the taps. */
  ring: readonly Location[];
}

const CLEAR: AddEntryStoreState = { step: null, location: null, ring: [] };

const FORMS: readonly Step[] = ['findForm', 'markerForm', 'zoneForm'];
const AIMING: readonly Step[] = ['findLocation', 'markerLocation', 'zoneDraw'];

/** The step back from a form to its point or its corners. Other steps end the flow. */
const BACK: Partial<Record<Step, Step>> = {
  findForm: 'findLocation',
  markerForm: 'markerLocation',
  zoneForm: 'zoneDraw',
};

/**
 * The flow behind the plus button. It keeps only the step and the collected data.
 * The {@link EntriesStore} saves the result, so the flow is testable without a network.
 */
export const AddEntryStore = signalStore(
  { providedIn: 'root' },
  withState<AddEntryStoreState>(CLEAR),
  withProps(() => ({ _stack: inject(OverlayStackService) })),
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
    return {
      /** The flow adds a step to the history, so the back gesture ends it. */
      open(): void {
        patchState(store, { step: 'actions' });
        store._stack.open(clear);
      },
      startFind(): void {
        patchState(store, { location: null, step: 'findLocation' });
      },
      startMarker(): void {
        patchState(store, { location: null, step: 'markerLocation' });
      },
      startZone(): void {
        patchState(store, { ring: [], step: 'zoneDraw' });
      },
      /** Sets the point and stays in the step. The point shows on the map. */
      setPoint(location: Location): void {
        patchState(store, { location });
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
