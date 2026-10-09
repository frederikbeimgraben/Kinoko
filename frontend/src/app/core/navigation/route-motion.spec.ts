import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, type ViewTransitionInfo } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ViewportService } from '../layout/viewport.service';
import { applyRouteMotion, routeMotion, type RouteMotion } from './route-motion';

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

describe('applyRouteMotion', () => {
  it('lets a transition without motion end at once instead of a skip, so no AbortError comes', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: { url: '/karte', currentNavigation: () => ({ finalUrl: '/karte?x=1' }) },
        },
        { provide: ViewportService, useValue: { wide: signal(false) } },
      ],
    });
    const transition = { skipTransition: vi.fn() };

    TestBed.runInInjectionContext(() => {
      applyRouteMotion({ transition } as unknown as ViewTransitionInfo);
    });

    expect(transition.skipTransition).not.toHaveBeenCalled();
    expect(document.documentElement.dataset['motion']).toBe('none');
  });
});
