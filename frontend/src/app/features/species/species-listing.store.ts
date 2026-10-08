import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withLinkedState,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { SpeciesFilterStore } from './filter.store';
import { listing } from './rows';
import { SpeciesStore } from './species.store';

/** The rows that the list shows at first and adds at the end of the scroll. */
export const LISTING_PAGE = 40;

/** The species list of the phone page and of the desktop pane: search, filter, sort and paging. */
export const SpeciesListingStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _catalogue: inject(SpeciesStore),
    _filter: inject(SpeciesFilterStore),
  })),
  withLinkedState(({ _filter }) => ({
    /** The count of shown rows. A new search or a new filter starts again at one page. */
    shown: () => {
      _filter.query();
      _filter.selection();
      _filter.sort();
      return LISTING_PAGE;
    },
  })),
  withComputed(({ _catalogue, _filter, shown }) => {
    const judged = computed(() =>
      listing(
        _catalogue.entries(),
        _filter.query(),
        _filter.selection(),
        _catalogue.palette(),
        _filter.sort(),
      ),
    );
    return {
      hits: computed(() => judged().hits.slice(0, shown())),
      unassessable: computed(() => judged().unknown),
      hasMore: computed(() => judged().hits.length > shown()),
    };
  }),
  withMethods((store) => ({
    more(): void {
      patchState(store, ({ shown }) => ({ shown: shown + LISTING_PAGE }));
    },
  })),
);

/** The instance type of {@link SpeciesListingStore}. */
export type SpeciesListingStore = InstanceType<typeof SpeciesListingStore>;
