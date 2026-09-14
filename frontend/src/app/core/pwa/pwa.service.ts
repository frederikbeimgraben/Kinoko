import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Das Ereignis, mit dem ein Browser die Installation anbietet. */
export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Service Worker, Installationsaufforderung und stille Aktualisierung.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly updates = inject(SwUpdate, { optional: true });

  private readonly _canInstall = signal(false);
  private readonly _updateReady = signal(false);
  private prompt: InstallPrompt | null = null;

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
    this.updates?.versionUpdates.subscribe((version) => {
      if (version.type === 'VERSION_READY') this._updateReady.set(true);
    });
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
    if (this.updates?.isEnabled !== true) return false;
    return this.updates.checkForUpdate();
  }
}
