import { describe, expect, it } from 'vitest';
import { routeMotion, type RouteMotion } from './route-motion';

const CASES: readonly [string | null, string, RouteMotion][] = [
  [null, '/karte', 'none'],
  ['/karte', '/karte?art=boletus-edulis', 'none'],
  ['/karte', '/arten', 'tab-forward'],
  ['/arten', '/eintraege', 'tab-forward'],
  ['/arten', '/karte', 'tab-back'],
  ['/eintraege', '/karte', 'tab-back'],
  ['/arten', '/arten/boletus-edulis', 'push'],
  ['/arten/boletus-edulis', '/arten', 'pop'],
  ['/arten/boletus-edulis', '/arten/agaricus-bisporus', 'none'],
  ['/konto', '/konto/gruppen', 'push'],
  ['/konto/gruppen', '/konto', 'pop'],
  ['/karte', '/konto', 'push'],
  ['/konto', '/karte', 'pop'],
  ['/verwaltung', '/verwaltung/texte', 'push'],
  ['/verwaltung/texte', '/verwaltung/texte/eintrag', 'push'],
  ['/verwaltung/texte', '/verwaltung/rollen', 'none'],
  ['/foo', '/bar', 'none'],
];

/** On the desktop a change in one section crossfades; a tab change moves as on the phone. */
const WIDE_CASES: readonly [string | null, string, RouteMotion][] = [
  [null, '/arten', 'none'],
  ['/arten', '/arten?q=stein', 'none'],
  ['/arten', '/arten/boletus-edulis', 'fade'],
  ['/arten/boletus-edulis', '/arten', 'fade'],
  ['/arten/boletus-edulis', '/arten/agaricus-bisporus', 'fade'],
  ['/konto', '/konto/gruppen', 'fade'],
  ['/karte', '/arten', 'tab-forward'],
  ['/karte', '/konto', 'push'],
];

describe('routeMotion', () => {
  it.each(CASES)('%s -> %s gives %s on the phone', (from, to, expected) => {
    expect(routeMotion(from, to)).toBe(expected);
  });

  it.each(WIDE_CASES)('%s -> %s gives %s on the desktop', (from, to, expected) => {
    expect(routeMotion(from, to, true)).toBe(expected);
  });
});
