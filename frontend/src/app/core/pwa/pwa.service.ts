import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Das Ereignis, mit dem ein Browser die Installation anbietet. */
export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const BOOT_WINDOW_MS = 10_000;

/**
 * Service Worker, Installationsaufforderung und stille Aktualisierung.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _canInstall = signal(false);
  private readonly _updateReady = signal(false);
  private prompt: InstallPrompt | null = null;
  private withinBootWindow = false;
  private pendingActivation = false;

  /** Ob der Browser die Installation anbietet. Firefox am Rechner tut es nicht. */
  readonly canInstall = this._canInstall.asReadonly();

  /** Ob eine Fassung bereitsteht. Der Wert dient dem Konto, nicht der Aktivierung. */
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

  /** Aktualisierung läuft still, ohne Hinweis und ohne Eingabe. */
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
        else this.pendingActivation = true;
      });
    this.destroyRef.onDestroy(() => {
      versionSub.unsubscribe();
    });

    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      void this.swUpdate.checkForUpdate();
      if (this.pendingActivation) void this.activate();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
    });

    const routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.pendingActivation) void this.activate();
      });
    this.destroyRef.onDestroy(() => {
      routerSub.unsubscribe();
    });
  }

  /** Aktiviert die wartende Fassung und lädt neu. */
  private async activate(): Promise<void> {
    this.pendingActivation = false;
    await this.swUpdate.activateUpdate();
    location.reload();
  }
}
