import { Injectable, isDevMode, signal } from '@angular/core';

/** Das Ereignis, mit dem ein Browser die Installation anbietet. */
export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const WORKER = 'ngsw-worker.js';

/**
 * Service Worker, Installationsaufforderung und stille Aktualisierung.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly _canInstall = signal(false);
  private readonly _updateReady = signal(false);
  private prompt: InstallPrompt | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  /** Ob der Browser die Installation anbietet. Firefox am Rechner tut es nicht. */
  readonly canInstall = this._canInstall.asReadonly();

  /** Ob eine Fassung bereitsteht. Sie gilt beim nächsten Start. */
  readonly updateReady = this._updateReady.asReadonly();

  init(): void {
    addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.prompt = event as InstallPrompt;
      this._canInstall.set(true);
    });
    addEventListener('appinstalled', () => {
      this.prompt = null;
      this._canInstall.set(false);
    });
    void this.register();
  }

  /** Fragt den Browser. Danach ist das Angebot verbraucht. */
  async install(): Promise<boolean> {
    const offer = this.prompt;
    if (offer === null) return false;
    this.prompt = null;
    this._canInstall.set(false);
    await offer.prompt();
    return (await offer.userChoice).outcome === 'accepted';
  }

  /** Fragt nach einer neuen Fassung, ohne etwas zu zeigen. */
  async check(): Promise<boolean> {
    if (this.registration === null) return false;
    await this.registration.update();
    return this._updateReady();
  }

  /** Der Service Worker läuft nur im Produktionsbuild. */
  private async register(): Promise<void> {
    if (isDevMode() || !('serviceWorker' in navigator)) return;
    try {
      this.registration = await navigator.serviceWorker.register(WORKER);
    } catch {
      return;
    }
    this.watch(this.registration);
  }

  /** Eine wartende Fassung meldet sich hier, nicht in der Oberfläche. */
  private watch(registration: ServiceWorkerRegistration): void {
    if (registration.waiting !== null) this._updateReady.set(true);
    registration.addEventListener('updatefound', () => {
      const fresh = registration.installing;
      if (fresh === null) return;
      fresh.addEventListener('statechange', () => {
        const done = fresh.state === 'installed' && navigator.serviceWorker.controller !== null;
        if (done) this._updateReady.set(true);
      });
    });
  }
}
