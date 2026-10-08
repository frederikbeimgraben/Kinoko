import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, firstValueFrom, map, of, pipe, switchMap, tap } from 'rxjs';
import { CombinationsApi } from '../../core/api/combinations.api';
import type { Combination, Rule } from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { withStorageSync } from '../../core/state';
import { encodeFactors, fromWire, readFactors, replaceFactor, toWire, type Factor } from './factors';

/** The key in the device storage. */
export const STORAGE_KEY = 'pilzkarte.combination.v1';

interface CombinationStoreState {
  rule: Rule;
  factors: readonly Factor[];
  /** The saved combinations of the account. Empty without an account. */
  saved: readonly Combination[];
}

interface Saved {
  rule: Rule;
  factors: string;
}

/** Makes a patch from a stored value. A value with a wrong shape gives no patch. */
export function restoreCombination(stored: unknown): Partial<CombinationStoreState> | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const raw = stored as Record<string, unknown>;
  const rule: Partial<CombinationStoreState> =
    raw['rule'] === 'intersection' || raw['rule'] === 'graded' ? { rule: raw['rule'] } : {};
  const factors: Partial<CombinationStoreState> =
    typeof raw['factors'] === 'string' ? { factors: readFactors(raw['factors']) } : {};
  return { ...rule, ...factors };
}

/** Rule, factors and the saved combinations of the account. */
export const CombinationStore = signalStore(
  { providedIn: 'root' },
  withState<CombinationStoreState>({ rule: 'intersection', factors: [], saved: [] }),
  withStorageSync<CombinationStoreState, Saved>({
    key: STORAGE_KEY,
    select: (state) => ({ rule: state.rule, factors: encodeFactors(state.factors) }),
    restore: restoreCombination,
  }),
  withProps(() => ({ _api: inject(CombinationsApi), _auth: inject(AuthService) })),
  withComputed(({ factors }) => ({
    active: computed(() => factors().filter((factor) => factor.active)),
  })),
  withMethods((store) => {
    const catalogue = () =>
      store._api.catalogue().pipe(
        map((page) => page.items),
        catchError(() => of<Combination[]>([])),
      );
    const reload = async (): Promise<void> => {
      patchState(store, { saved: await firstValueFrom(catalogue()) });
    };
    const apply = (factor: Factor): void => {
      patchState(store, (state) => ({ factors: replaceFactor(state.factors, factor) }));
    };
    return {
      setRule(rule: Rule): void {
        patchState(store, { rule });
      },
      apply,
      remove(factor: Factor): void {
        patchState(store, (state) => ({
          factors: state.factors.filter((entry) => entry.source !== factor.source),
        }));
      },
      /** A new source starts with the upper half of its scale. */
      start(source: string, low: number, high: number): Factor {
        const factor: Factor = {
          source,
          condition: 'above',
          low: low + (high - low) / 2,
          high: 0,
          active: true,
        };
        apply(factor);
        return factor;
      },
      pick(combination: Combination): void {
        patchState(store, {
          rule: combination.rule ?? 'intersection',
          factors: (combination.factors ?? []).map(fromWire),
        });
      },
      async save(name: string): Promise<boolean> {
        try {
          await firstValueFrom(
            store._api.create({ name, rule: store.rule(), factors: store.factors().map(toWire) }),
          );
          await reload();
          return true;
        } catch {
          return false;
        }
      },
      async delete(combination: Combination): Promise<void> {
        try {
          await firstValueFrom(store._api.remove(combination.id));
          await reload();
        } catch {
          // The ApiClient already showed the error as a toast.
        }
      },
      _follow: rxMethod<boolean>(
        pipe(
          switchMap((signedIn) => (signedIn ? catalogue() : of<Combination[]>([]))),
          tap((saved) => {
            patchState(store, { saved });
          }),
        ),
      ),
    };
  }),
  withHooks({
    onInit(store) {
      store._follow(store._auth.signedIn);
    },
  }),
);

/** The instance type of {@link CombinationStore}. */
export type CombinationStore = InstanceType<typeof CombinationStore>;
