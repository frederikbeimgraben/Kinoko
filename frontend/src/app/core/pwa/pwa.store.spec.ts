import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent, type VersionReadyEvent } from '@angular/service-worker';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { Subject } from 'rxjs';
import { PwaStore, type InstallPrompt } from './pwa.store';

const VERSION_READY: VersionReadyEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'a' },
  latestVersion: { hash: 'b' },
};

/** An offer of the browser to install the app. */
function offer(outcome: 'accepted' | 'dismissed'): Event {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome }),
  });
}

/** `SwUpdate` with a `versionUpdates` stream that the test controls. */
class SwUpdateDouble {
  isEnabled = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly checkForUpdate = vi.fn().mockResolvedValue(false);
  readonly activateUpdate = vi.fn().mockResolvedValue(true);
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function store(swUpdate: SwUpdateDouble): PwaStore {
  TestBed.configureTestingModule({
    providers: [{ provide: SwUpdate, useValue: swUpdate }],
  });
  const pwa = TestBed.inject(PwaStore);
  pwa.init();
  return pwa;
}

describe('PwaStore', () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockClear();
    vi.stubGlobal('location', { reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setVisibility('visible');
  });

  it('offers the installation when the browser asks', async () => {
    const pwa = store(new SwUpdateDouble());
    expect(pwa.canInstall()).toBe(false);

    dispatchEvent(offer('accepted'));

    expect(pwa.canInstall()).toBe(true);
    expect(await pwa.install()).toBe(true);
    expect(pwa.canInstall()).toBe(false);
  });

  it('reports a refused installation', async () => {
    const pwa = store(new SwUpdateDouble());
    dispatchEvent(offer('dismissed'));

    expect(await pwa.install()).toBe(false);
  });

  it('does not install without an offer', async () => {
    expect(await store(new SwUpdateDouble()).install()).toBe(false);
  });

  it('forgets the offer after the installation', () => {
    const pwa = store(new SwUpdateDouble());
    dispatchEvent(offer('accepted'));

    dispatchEvent(new Event('appinstalled'));

    expect(pwa.canInstall()).toBe(false);
  });

  it('derives the install offer from a patched state', () => {
    const pwa = store(new SwUpdateDouble());

    patchState(unprotected(pwa), { prompt: offer('accepted') as InstallPrompt });

    expect(pwa.canInstall()).toBe(true);
  });

  describe('update', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('activates a version at once when it is ready within 10 s', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = store(swUpdate);

      swUpdate.versionUpdates.next(VERSION_READY);
      await vi.waitFor(() => {
        expect(swUpdate.activateUpdate).toHaveBeenCalledOnce();
      });

      expect(pwa.updateReady()).toBe(true);
      expect(reload).toHaveBeenCalledOnce();
    });

    it('does not activate at once when the version is ready after 10 s', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = store(swUpdate);

      await vi.advanceTimersByTimeAsync(10_001);
      swUpdate.versionUpdates.next(VERSION_READY);

      expect(pwa.updateReady()).toBe(true);
      expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('does not activate a late version when the app becomes visible', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = store(swUpdate);
      await vi.advanceTimersByTimeAsync(10_001);
      swUpdate.versionUpdates.next(VERSION_READY);

      setVisibility('visible');

      expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect(pwa.updateReady()).toBe(true);
    });

    it('activates a ready version on request', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = store(swUpdate);
      await vi.advanceTimersByTimeAsync(10_001);
      swUpdate.versionUpdates.next(VERSION_READY);

      await pwa.activate();

      expect(swUpdate.activateUpdate).toHaveBeenCalledOnce();
      expect(reload).toHaveBeenCalledOnce();
    });

    it('asks for a new version each time the app becomes visible', () => {
      const swUpdate = new SwUpdateDouble();
      store(swUpdate);

      setVisibility('hidden');
      setVisibility('visible');

      expect(swUpdate.checkForUpdate).toHaveBeenCalledOnce();
    });

    it('does not ask for a version when the app goes to the background', () => {
      const swUpdate = new SwUpdateDouble();
      store(swUpdate);

      setVisibility('hidden');

      expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
    });

    it('does nothing when the service worker is not active', () => {
      const swUpdate = new SwUpdateDouble();
      swUpdate.isEnabled = false;
      const pwa = store(swUpdate);

      setVisibility('hidden');
      setVisibility('visible');

      expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
      expect(pwa.updateReady()).toBe(false);
    });

    it('works without `provideServiceWorker`', async () => {
      TestBed.configureTestingModule({});
      const pwa = TestBed.inject(PwaStore);

      expect(() => {
        pwa.init();
      }).not.toThrow();
      await expect(pwa.activate()).resolves.toBeUndefined();
      expect(pwa.updateReady()).toBe(false);
    });
  });
});
