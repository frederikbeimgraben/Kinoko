import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { withStorageSync } from '../../core/state';
import { EMPTY_SELECTION, GROUP_KEYS, type GroupKey, type Selection } from './facets';

const STORAGE_KEY = 'pilzkarte.speciesfilter';

/** The orders of the species list, in the order of the sort popover. */
export const SPECIES_SORTS = ['name', 'latin', 'edibility', 'season'] as const;
export type SpeciesSort = (typeof SPECIES_SORTS)[number];

interface FilterState {
  selection: Selection;
  sort: SpeciesSort;
  /** The search text of the list. It stays when the person opens a species and comes back. */
  query: string;
  /** True while the filter sheet is open over the list. */
  open: boolean;
  /** The group that the sheet shows. `null` is the overview. */
  group: GroupKey | null;
}

/** The stored form of the selection. */
interface Saved {
  values: Record<string, string[]>;
  colours: Record<string, string>;
  keepUnknown: string[];
  sort?: SpeciesSort;
}

function isGroup(value: unknown): value is GroupKey {
  return typeof value === 'string' && (GROUP_KEYS as readonly string[]).includes(value);
}

function isSort(value: unknown): value is SpeciesSort {
  return typeof value === 'string' && (SPECIES_SORTS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The stored form of a selection and a sort. */
export function savedOf(selection: Selection, sort: SpeciesSort): Saved {
  return {
    values: Object.fromEntries([...selection.values].map(([key, set]) => [key, [...set]])),
    colours: Object.fromEntries(selection.colours),
    keepUnknown: [...selection.keepUnknown],
    ...(sort === 'name' ? {} : { sort }),
  };
}

/** Reads a stored selection. A value with a wrong shape is dropped, not taken. */
export function restoreSaved(stored: unknown): Pick<FilterState, 'selection' | 'sort'> | null {
  if (!isRecord(stored)) return null;
  const values = isRecord(stored['values']) ? stored['values'] : {};
  const colours = isRecord(stored['colours']) ? stored['colours'] : {};
  const keep = Array.isArray(stored['keepUnknown']) ? (stored['keepUnknown'] as unknown[]) : [];
  return {
    selection: {
      values: new Map(
        Object.entries(values)
          .filter(
            (entry): entry is [GroupKey, string[]] =>
              isGroup(entry[0]) && Array.isArray(entry[1]) && entry[1].length > 0,
          )
          .map(([key, chosen]) => [key, new Set(chosen)]),
      ),
      colours: new Map(
        Object.entries(colours).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      ),
      keepUnknown: new Set(keep.filter(isGroup)),
    },
    sort: isSort(stored['sort']) ? stored['sort'] : 'name',
  };
}

/** Adds `value` to a set, or removes it when the set has it. */
function flipped<T>(held: ReadonlySet<T>, value: T): Set<T> {
  return held.has(value) ? new Set([...held].filter((one) => one !== value)) : new Set(held).add(value);
}

/** The choice in the filter sheet. Values in one group are "or", groups are "and". */
export const SpeciesFilterStore = signalStore(
  { providedIn: 'root' },
  withState<FilterState>({
    selection: EMPTY_SELECTION,
    sort: 'name',
    query: '',
    open: false,
    group: null,
  }),
  withStorageSync<FilterState, Saved>({
    key: STORAGE_KEY,
    select: ({ selection, sort }) => savedOf(selection, sort),
    restore: restoreSaved,
  }),
  withProps(() => ({ _stack: inject(OverlayStackService) })),
  withComputed(({ selection }) => ({
    chosenCount: computed(() => {
      const held = selection();
      return [...held.values.values()].reduce((sum, set) => sum + set.size, 0) + held.colours.size;
    }),
  })),
  withMethods((store) => {
    const patchSelection = (change: (held: Selection) => Selection): void => {
      patchState(store, ({ selection }) => ({ selection: change(selection) }));
    };

    const toggle = (key: GroupKey, value: string): void => {
      patchSelection((held) => {
        const chosen = flipped(held.values.get(key) ?? new Set<string>(), value);
        const values = new Map(held.values);
        if (chosen.size > 0) values.set(key, chosen);
        else values.delete(key);
        return { ...held, values };
      });
    };

    const setColour = (part: string, hex: string | null): void => {
      patchSelection((held) => {
        const colours = new Map(held.colours);
        if (hex === null || colours.get(part) === hex) colours.delete(part);
        else colours.set(part, hex);
        return { ...held, colours };
      });
    };

    return {
      chosenIn(key: GroupKey): ReadonlySet<string> {
        return store.selection().values.get(key) ?? new Set();
      },

      colourOf(part: string): string | null {
        return store.selection().colours.get(part) ?? null;
      },

      keeps(key: GroupKey): boolean {
        return store.selection().keepUnknown.has(key);
      },

      toggle,
      setColour,

      toggleKeepUnknown(key: GroupKey): void {
        patchSelection((held) => ({ ...held, keepUnknown: flipped(held.keepUnknown, key) }));
      },

      /** Removes one value from the filter. The chip over the list does this. */
      dropValue(key: GroupKey, value: string): void {
        toggle(key, value);
      },

      dropColour(part: string): void {
        setColour(part, null);
      },

      clearAll(): void {
        patchState(store, { selection: EMPTY_SELECTION });
      },

      setSort(sort: SpeciesSort): void {
        patchState(store, { sort });
      },

      setQuery(query: string): void {
        patchState(store, { query });
      },

      /** Opens the sheet and adds a way back through the address bar. */
      openSheet(): void {
        if (store.open()) return;
        patchState(store, { open: true, group: null });
        store._stack.open(() => {
          patchState(store, { open: false, group: null });
        });
      },

      /** Closes the sheet fully, also from an open group. */
      closeSheet(): void {
        if (!store.open()) return;
        patchState(store, { open: false, group: null });
        store._stack.closeAll();
      },

      /** Goes into a group or, with `null`, back to the overview. */
      showGroup(key: GroupKey | null): void {
        if (key === store.group()) return;
        if (key === null) {
          patchState(store, { group: null });
          store._stack.back();
          return;
        }
        patchState(store, { group: key });
        store._stack.open(() => {
          patchState(store, { group: null });
        });
      },
    };
  }),
);

/** The instance type of {@link SpeciesFilterStore}. */
export type SpeciesFilterStore = InstanceType<typeof SpeciesFilterStore>;
