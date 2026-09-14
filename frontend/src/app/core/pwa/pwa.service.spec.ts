import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { PwaService } from './pwa.service';

/** Ein Angebot des Browsers, die App zu installieren. */
function offer(outcome: 'accepted' | 'dismissed'): Event {
  const event = new Event('beforeinstallprompt');
  return Object.assign(event, {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome }),
  });
}

class UpdateStub {
  readonly versionUpdates = new Subject<VersionEvent>();
  isEnabled = true;
  found = true;

  checkForUpdate(): Promise<boolean> {
    return Promise.resolve(this.found);
  }
}

function service(updates: UpdateStub | null = null): PwaService {
  TestBed.configureTestingModule({
    providers: updates === null ? [] : [{ provide: SwUpdate, useValue: updates }],
  });
  const pwa = TestBed.inject(PwaService);
  pwa.init();
  return pwa;
}

describe('PwaService', () => {
  it('bietet die Installation an, sobald der Browser fragt', async () => {
    const pwa = service();
    expect(pwa.canInstall()).toBe(false);

    dispatchEvent(offer('accepted'));

    expect(pwa.canInstall()).toBe(true);
    expect(await pwa.install()).toBe(true);
    expect(pwa.canInstall()).toBe(false);
  });

  it('meldet eine abgelehnte Installation', async () => {
    const pwa = service();
    dispatchEvent(offer('dismissed'));

    expect(await pwa.install()).toBe(false);
  });

  it('installiert nicht ohne Angebot', async () => {
    expect(await service().install()).toBe(false);
  });

  it('vergisst das Angebot nach der Installation', () => {
    const pwa = service();
    dispatchEvent(offer('accepted'));

    dispatchEvent(new Event('appinstalled'));

    expect(pwa.canInstall()).toBe(false);
  });

  it('merkt sich eine bereitstehende Fassung, ohne sie zu zeigen', () => {
    const updates = new UpdateStub();
    const pwa = service(updates);
    expect(pwa.updateReady()).toBe(false);

    updates.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'alt' },
      latestVersion: { hash: 'neu' },
    });

    expect(pwa.updateReady()).toBe(true);
  });

  it('fragt den Service Worker nach einer neuen Fassung', async () => {
    expect(await service(new UpdateStub()).check()).toBe(true);
  });

  it('fragt nicht, solange der Service Worker aus ist', async () => {
    const updates = new UpdateStub();
    updates.isEnabled = false;

    expect(await service(updates).check()).toBe(false);
  });

  it('fragt nicht ohne Service Worker', async () => {
    expect(await service().check()).toBe(false);
  });
});
