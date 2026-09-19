import { inject } from '@angular/core';
import { Router, type ViewTransitionInfo } from '@angular/router';

/** Art des Übergangs zwischen zwei Adressen. */
export type RouteMotion = 'tab-forward' | 'tab-back' | 'push' | 'pop' | 'none';

/** Die drei Reiter, in ihrer Reihenfolge auf der Leiste. */
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

/** Übergangsart aus alter und neuer Adresse, `from` `null` beim ersten Laden. */
export function routeMotion(from: string | null, to: string): RouteMotion {
  if (from === null || pathOf(from) === pathOf(to)) return 'none';

  const fromSegments = segmentsOf(from);
  const toSegments = segmentsOf(to);
  const fromSection = fromSegments[0] ?? '';
  const toSection = toSegments[0] ?? '';

  if (fromSection === toSection) {
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

/** Setzt `data-motion` am `<html>` und bricht ohne Bewegung oder bei `prefers-reduced-motion` ab. */
export function applyRouteMotion({ transition }: ViewTransitionInfo): void {
  const router = inject(Router);
  const from = router.url;
  const to = router.currentNavigation()?.finalUrl?.toString() ?? from;
  const motion = routeMotion(from, to);

  document.documentElement.dataset['motion'] = motion;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (motion === 'none' || reduced) transition.skipTransition();
}
