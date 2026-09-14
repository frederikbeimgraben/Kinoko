import { TestBed } from '@angular/core/testing';
import { PwaService } from './pwa.service';

/** Ein Angebot des Browsers, die App zu installieren. */
function offer(outcome: 'accepted' | 'dismissed'): Event {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome }),
  });
}

/** Ein Service Worker, der eine wartende Fassung melden kann. */
class RegistrationDouble extends EventTarget {
  waiting: ServiceWorker | null = null;
  installing: ServiceWorker | null = null;
  updates = 0;

  update(): Promise<void> {
    this.updates += 1;
    return Promise.resolve();
  }
}

/** Ein Arbeiter, der seinen Zustand meldet. */
class WorkerDouble extends EventTarget {
  state = 'installing';

  install(): void {
    this.state = 'installed';
    this.dispatchEvent(new Event('statechange'));
  }
}

function stubWorkers(registration: RegistrationDouble | null, controlled = true): void {
  vi.stubGlobal('navigator', {
    language: navigator.language,
    serviceWorker: {
      register: () =>
        registration === null ? Promise.reject(new Error('gesperrt')) : Promise.resolve(registration),
      controller: controlled ? {} : null,
    },
  });
}

function service(): PwaService {
  TestBed.configureTestingModule({});
  const pwa = TestBed.inject(PwaService);
  pwa.init();
  return pwa;
}

describe('PwaService', () => {
  beforeEach(() => {
    // Im Test läuft der Entwicklungsmodus. Er hält die Registrierung zurück,
    // darum stellt jeder Test sie selbst.
    vi.stubGlobal('ngDevMode', false);
  });

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

  it('meldet eine wartende Fassung schon bei der Registrierung', async () => {
    const registration = new RegistrationDouble();
    registration.waiting = {} as ServiceWorker;
    stubWorkers(registration);

    const pwa = service();
    await vi.waitFor(() => {
      expect(pwa.updateReady()).toBe(true);
    });
  });

  it('merkt sich eine neue Fassung, ohne sie zu zeigen', async () => {
    const registration = new RegistrationDouble();
    const worker = new WorkerDouble();
    stubWorkers(registration);
    const pwa = service();
    await vi.waitFor(() => {
      expect(registration.updates).toBe(0);
    });
    expect(pwa.updateReady()).toBe(false);

    registration.installing = worker as unknown as ServiceWorker;
    registration.dispatchEvent(new Event('updatefound'));
    worker.install();

    expect(pwa.updateReady()).toBe(true);
  });

  it('fragt den Service Worker nach einer neuen Fassung', async () => {
    const registration = new RegistrationDouble();
    stubWorkers(registration);
    const pwa = service();
    await vi.waitFor(() => {
      expect(registration.updates).toBe(0);
    });

    expect(await pwa.check()).toBe(false);
    expect(registration.updates).toBe(1);
  });

  it('fragt nicht ohne Registrierung', async () => {
    stubWorkers(null);

    expect(await service().check()).toBe(false);
  });
});
