import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, type NavigationExtras } from '@angular/router';
import { filter, map, scan } from 'rxjs';

/** One router step: the start of a navigation, or its end with the extras of the navigation. */
export type HistoryStep =
  | {
      readonly kind: 'start';
      readonly id: number;
      readonly popped: boolean;
      readonly restored: number | null;
    }
  | { readonly kind: 'end'; readonly id: number; readonly url: string; readonly extras: NavigationExtras };

/** The app entries in the browser history. `depth` counts the app entries behind the current entry. */
export interface AppHistory {
  readonly depth: number;
  /** The depth of each entry, by the navigation id in its history state. */
  readonly depths: ReadonlyMap<number, number>;
  readonly start: Extract<HistoryStep, { kind: 'start' }> | null;
  readonly url: string | null;
}

export const NO_HISTORY: AppHistory = { depth: 0, depths: new Map(), start: null, url: null };

/** Applies one router step. A page opened from a link has depth 0, also after a back step to it. */
export function followHistory(known: AppHistory, step: HistoryStep): AppHistory {
  if (step.kind === 'start') return { ...known, start: step };
  const { start, url, depth, depths } = known;
  if (start?.id !== step.id || step.extras.skipLocationChange === true) return { ...known, start: null };
  const next = ((): number => {
    // An entry from before a reload has an unknown id, so it counts as the first entry.
    if (start.popped) return start.restored === null ? 0 : (depths.get(start.restored) ?? 0);
    if (url === null) return 0;
    return step.extras.replaceUrl === true || url === step.url ? depth : depth + 1;
  })();
  return { depth: next, depths: new Map(depths).set(step.id, next), start: null, url: step.url };
}

/** Goes back from a subpage without a loop in the history, and never out of the app. */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly known = toSignal(
    this.router.events.pipe(
      map((event): HistoryStep | null => {
        if (event instanceof NavigationStart) {
          const restored = event.restoredState?.navigationId ?? null;
          return { kind: 'start', id: event.id, popped: event.navigationTrigger === 'popstate', restored };
        }
        if (!(event instanceof NavigationEnd)) return null;
        const extras = this.router.lastSuccessfulNavigation()?.extras ?? {};
        return { kind: 'end', id: event.id, url: event.urlAfterRedirects, extras };
      }),
      filter((step): step is HistoryStep => step !== null),
      scan(followHistory, NO_HISTORY),
    ),
    { initialValue: NO_HISTORY },
  );

  /** Goes one step back. Without an app entry behind this page, `fallback` replaces the entry. */
  back(fallback: readonly string[]): void {
    if (this.known().depth > 0) {
      this.location.back();
      return;
    }
    void this.router.navigate([...fallback], { replaceUrl: true });
  }
}
