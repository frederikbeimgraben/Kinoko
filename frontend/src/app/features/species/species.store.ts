import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, filter, firstValueFrom, map, mergeMap, pipe, tap } from 'rxjs';
import { SpeciesApi } from '../../core/api/species.api';
import type { SpeciesBundle, SpeciesEntry, StandardColour } from '../../core/api/models';
import type { components } from '../../core/api/contract';
import { I18nService } from '../../core/i18n/i18n.service';
import { OfflineStore } from '../../core/offline/offline-store';
import { factsOf, type Counts, type Facts } from './facets';
import { localSpecies } from './species-names';

/** A species with the filter axes calculated from it. */
export interface CatalogueEntry {
  readonly species: SpeciesEntry;
  readonly facts: Facts;
}

/** One reaction of a species to a reagent, as the profile gives it. */
export type SpeciesReaction = components['schemas']['SpeciesReaction'];

const BUNDLE_KEY = 'bundle';
const ETAG_KEY = 'etag';

/** True when a bundle has all the fields of the baseline. The ETag counts only the species. */
export function completeBundle(bundle: unknown): bundle is SpeciesBundle {
  if (typeof bundle !== 'object' || bundle === null) return false;
  const shape = bundle as Record<string, unknown>;
  return (
    Array.isArray(shape['items']) &&
    Array.isArray(shape['standardColours']) &&
    typeof shape['facets'] === 'object' &&
    shape['facets'] !== null
  );
}

interface SpeciesStoreState {
  bundle: SpeciesBundle | null;
  failed: boolean;
  activeSpecies: string | null;
  /** The full details from the service. Only a profile has the reactions. */
  details: ReadonlyMap<string, SpeciesEntry>;
  /** The slugs whose profile is requested or known. */
  asked: ReadonlySet<string>;
}

const INITIAL: SpeciesStoreState = {
  bundle: null,
  failed: false,
  activeSpecies: null,
  details: new Map(),
  asked: new Set(),
};

/** The species catalogue on the device. Search, filter and the species pages read it. */
export const SpeciesStore = signalStore(
  { providedIn: 'root' },
  withState<SpeciesStoreState>(INITIAL),
  withProps(() => ({ _api: inject(SpeciesApi), _offline: inject(OfflineStore), _i18n: inject(I18nService) })),
  withComputed(({ bundle, _i18n }) => {
    const species = computed<readonly SpeciesEntry[]>(() =>
      (bundle()?.items ?? []).map((one) => localSpecies(one, _i18n.locale())),
    );
    const palette = computed<readonly StandardColour[]>(() => bundle()?.standardColours ?? []);
    const entries = computed<readonly CatalogueEntry[]>(() =>
      species().map((one) => ({ species: one, facts: factsOf(one, palette()) })),
    );
    return {
      /** All species, with the names in the language of the interface. Empty means that nothing is loaded yet. */
      species,
      /** The twelve standard colours of the filter. */
      palette,
      /** The counted axes of the catalogue. */
      facets: computed<Counts>(() => bundle()?.facets ?? {}),
      entries,
      facts: computed<readonly Facts[]>(() => entries().map((one) => one.facts)),
      _bySlug: computed(() => new Map(species().map((one) => [one.slug, one]))),
      _byId: computed(() => new Map(species().map((one) => [one.id, one]))),
    };
  }),
  withComputed(({ bundle, failed }) => ({
    /** True while the catalogue is missing and no error is known. */
    loading: computed(() => bundle() === null && !failed()),
  })),
  withMethods((store) => {
    let running: Promise<void> | null = null;

    const fromDevice = async (): Promise<void> => {
      const known = await store._offline.get<unknown>('catalog', BUNDLE_KEY);
      if (completeBundle(known)) patchState(store, { bundle: known });
    };

    const fromService = async (): Promise<void> => {
      const etag = store.bundle() === null ? null : await store._offline.get<string>('catalog', ETAG_KEY);
      const answer = await firstValueFrom(store._api.bundle(etag)).catch(() => null);
      if (answer === null) {
        patchState(store, { failed: store.bundle() === null });
        return;
      }
      await store._offline.put('catalog', ETAG_KEY, answer.etag);
      if (answer.body !== null) {
        patchState(store, { bundle: answer.body });
        await store._offline.put('catalog', BUNDLE_KEY, answer.body);
      }
    };

    const loadBundle = (): Promise<void> => {
      running ??= fromDevice()
        .then(fromService)
        .finally(() => {
          running = null;
        });
      return running;
    };

    return {
      /** Shows the catalogue from the device, then compares it with the service by ETag. */
      loadBundle,

      /** Gets the catalogue again after a load error. */
      reload(): void {
        patchState(store, { failed: false });
        void loadBundle();
      },

      entryOf(slug: string): SpeciesEntry | null {
        return store._bySlug().get(slug) ?? null;
      },

      entryById(id: string): SpeciesEntry | null {
        return store._byId().get(id) ?? null;
      },

      nameOf(slug: string): string | null {
        return store._bySlug().get(slug)?.name ?? null;
      },

      select(slug: string | null): void {
        patchState(store, { activeSpecies: slug });
      },

      /** The reactions of a species from its profile. Empty until the profile is known. */
      reactionsOf(slug: string): readonly SpeciesReaction[] {
        return store.details().get(slug)?.reactions ?? [];
      },

      /** Gets the full profile of each slug one time. A failed request leaves the slug without reactions. */
      loadProfile: rxMethod<string>(
        pipe(
          filter((slug) => slug !== '' && !store.asked().has(slug)),
          tap((slug) => {
            patchState(store, ({ asked }) => ({ asked: new Set(asked).add(slug) }));
          }),
          mergeMap((slug) =>
            store._api.profile(slug).pipe(
              map((profile) => ({ slug, profile })),
              catchError(() => EMPTY),
            ),
          ),
          tap(({ slug, profile }) => {
            patchState(store, ({ details }) => ({ details: new Map(details).set(slug, profile) }));
          }),
        ),
      ),
    };
  }),
);

/** The instance type of {@link SpeciesStore}. */
export type SpeciesStore = InstanceType<typeof SpeciesStore>;
