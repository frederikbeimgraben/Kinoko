import { inject } from '@angular/core';
import { Router, type ViewTransitionInfo } from '@angular/router';
import { ViewportService } from '../layout/viewport.service';
import { attachSharedElement } from './shared-element';

/** The kind of transition between two addresses. */
export type RouteMotion = 'tab-forward' | 'tab-back' | 'push' | 'pop' | 'fade' | 'none';

/** The three tabs, in their order on the nav. */
const TAB_ORDER: readonly string[] = ['karte', 'arten', 'eintraege'];

function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}

function segmentsOf(url: string): readonly string[] {
  return pathOf(url).split('/').filter(Boolean);
}

function isPrefixOf(shorter: readonly string[], longer: readonly string[]): boolean {
  return shorter.length < longer.length && shorter.every((part, index) => part === longer[index]);
}

/** The transition from the old and the new address; `from` is `null` on the first load.
 * On the desktop a change in one section is a crossfade, so the list pane stays still. */
export function routeMotion(from: string | null, to: string, wide = false): RouteMotion {
  if (from === null || pathOf(from) === pathOf(to)) return 'none';

  const fromSegments = segmentsOf(from);
  const toSegments = segmentsOf(to);
  const fromSection = fromSegments[0] ?? '';
  const toSection = toSegments[0] ?? '';

  if (fromSection === toSection) {
    if (wide) return 'fade';
    if (isPrefixOf(fromSegments, toSegments)) return 'push';
    if (isPrefixOf(toSegments, fromSegments)) return 'pop';
    return 'none';
  }

  const fromTab = TAB_ORDER.indexOf(fromSection);
  const toTab = TAB_ORDER.indexOf(toSection);
  if (fromTab !== -1 && toTab !== -1) return toTab > fromTab ? 'tab-forward' : 'tab-back';
  if (toTab === -1 && fromTab !== -1) return 'push';
  if (fromTab === -1 && toTab !== -1) return 'pop';
  return 'none';
}

/** Sets `data-motion` on `<html>`. It skips the transition without motion or with `prefers-reduced-motion`. */
export function applyRouteMotion({ transition }: ViewTransitionInfo): void {
  const router = inject(Router);
  const wide = inject(ViewportService).wide();
  const from = router.url;
  const to = router.currentNavigation()?.finalUrl?.toString() ?? from;
  const motion = routeMotion(from, to, wide);

  document.documentElement.dataset['motion'] = motion;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skipped = motion === 'none' || reduced;
  attachSharedElement(transition, skipped);
  if (skipped) transition.skipTransition();
}
