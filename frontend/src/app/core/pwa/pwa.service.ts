import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Das Ereignis, mit dem ein Browser die Installation anbietet. */
export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UpdateWindow extends Window {
  pilzUpdate?: { ready: () => void };
}

const BOOT_WINDOW_MS = 10_000;

/**
 * Service Worker, Installationsaufforderung und stille Aktualisierung.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _canInstall = signal(false);
  private readonly _updateReady = signal(false);
  private prompt: InstallPrompt | null = null;
  private withinBootWindow = false;

  /** Ob der Browser die Installation anbietet. Firefox am Rechner tut es nicht. */
  readonly canInstall = this._canInstall.asReadonly();

  /** Ob eine Fassung bereitsteht: zeigt die Leiste und den Wert im Konto. */
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
    this.watchUpdates();
    // Ein Haken für den Board-Test: er meldet eine Fassung ohne echten
    // Service Worker, den der Testlauf sonst blockt.
    (window as UpdateWindow).pilzUpdate = {
      ready: () => {
        this._updateReady.set(true);
      },
    };
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

  /** Beim Start aktiviert eine Fassung sich still. Im Betrieb wartet sie auf die Person. */
  private watchUpdates(): void {
    if (!this.swUpdate.isEnabled) return;

    this.withinBootWindow = true;
    const bootTimer = setTimeout(() => {
      this.withinBootWindow = false;
    }, BOOT_WINDOW_MS);
    this.destroyRef.onDestroy(() => {
      clearTimeout(bootTimer);
    });

    const versionSub = this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this._updateReady.set(true);
        if (this.withinBootWindow) void this.activate();
      });
    this.destroyRef.onDestroy(() => {
      versionSub.unsubscribe();
    });

    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      void this.swUpdate.checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** Aktiviert die wartende Fassung und lädt neu: beim Start still, sonst auf Knopfdruck. */
  async activate(): Promise<void> {
    await this.swUpdate.activateUpdate();
    location.reload();
  }
}
