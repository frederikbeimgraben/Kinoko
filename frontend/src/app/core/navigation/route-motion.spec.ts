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

describe('routeMotion', () => {
  it.each(CASES)('%s -> %s ergibt %s', (from, to, expected) => {
    expect(routeMotion(from, to)).toBe(expected);
  });
});
