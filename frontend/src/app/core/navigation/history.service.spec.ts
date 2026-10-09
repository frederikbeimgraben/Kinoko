import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  HistoryService,
  NO_HISTORY,
  followHistory,
  type AppHistory,
  type HistoryStep,
} from './history.service';

@Component({ template: '' })
class PageDouble {}

interface Setup {
  history: HistoryService;
  router: Router;
  location: Location;
}

async function build(first: string): Promise<Setup> {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: '**', component: PageDouble }]), provideLocationMocks()],
  });
  const history = TestBed.inject(HistoryService);
  const router = TestBed.inject(Router);
  // The app bootstrap starts this listener. A unit test has no bootstrap.
  router.setUpLocationChangeListener();
  await router.navigateByUrl(first);
  return { history, router, location: TestBed.inject(Location) };
}

/** Lets the router start and finish the navigation of a back step. The router starts it in a timer. */
async function settle(router: Router): Promise<void> {
  await new Promise((done) => setTimeout(done, 0));
  await vi.waitFor(() => {
    expect(router.currentNavigation()).toBeNull();
  });
}

function steps(...list: HistoryStep[]): AppHistory {
  return list.reduce(followHistory, NO_HISTORY);
}

const start = (id: number, restored: number | null = null): HistoryStep => ({
  kind: 'start',
  id,
  popped: restored !== null,
  restored,
});
const end = (id: number, url: string, replaceUrl = false): HistoryStep => ({
  kind: 'end',
  id,
  url,
  extras: { replaceUrl },
});

describe('followHistory', () => {
  it('counts the app entries behind the page', () => {
    expect(steps(start(1), end(1, '/arten/a')).depth).toBe(0);
    expect(steps(start(1), end(1, '/arten/a'), start(2), end(2, '/arten/b')).depth).toBe(1);
  });

  it('keeps the depth for a replaced entry and for the same address', () => {
    const known = steps(start(1), end(1, '/arten'), start(2), end(2, '/arten/a', true));
    expect(known.depth).toBe(0);
    expect(followHistory(followHistory(known, start(3)), end(3, '/arten/a')).depth).toBe(0);
  });

  it('takes the depth of the entry that a back step restores', () => {
    const known = steps(
      start(1),
      end(1, '/arten/a'),
      start(2),
      end(2, '/arten/b'),
      start(3, 1),
      end(3, '/arten/a'),
    );
    expect(known.depth).toBe(0);
  });

  it('counts an entry from before a reload as the first entry', () => {
    expect(steps(start(1), end(1, '/arten/b'), start(2, 7), end(2, '/arten/a')).depth).toBe(0);
  });
});

describe('HistoryService', () => {
  it('goes one step back when the app has a page behind this page', async () => {
    const { history, router, location } = await build('/arten');
    await router.navigateByUrl('/arten/boletus-edulis');
    const back = vi.spyOn(location, 'back');

    history.back(['/arten']);

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('replaces the entry with the parent page when the page came from a link', async () => {
    const { history, router, location } = await build('/arten/boletus-edulis');
    const back = vi.spyOn(location, 'back');
    const navigate = vi.spyOn(router, 'navigate');

    history.back(['/arten']);
    await settle(router);

    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/arten'], { replaceUrl: true });
    expect(router.url).toBe('/arten');
  });

  it('never leaves the app after a back step to the page from the link', async () => {
    const { history, router, location } = await build('/arten/boletus-edulis');
    await router.navigateByUrl('/arten/boletus-reticulatus');
    history.back(['/arten']);
    await settle(router);
    expect(router.url).toBe('/arten/boletus-edulis');
    const back = vi.spyOn(location, 'back');

    history.back(['/arten']);
    await settle(router);

    expect(back).not.toHaveBeenCalled();
    expect(router.url).toBe('/arten');
  });
});
