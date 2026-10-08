import { Injectable, computed, signal } from '@angular/core';

/** The own location, as the device reports it. */
export interface OwnLocation {
  lon: number;
  lat: number;
  /** The radius in meters that contains the true point. */
  accuracy: number;
}

// The own location as a signal. Without permission, `allowed` is false and the page hides the button.
// The service listens to `permissions` changes, because the user can grant a denied permission again.
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly _location = signal<OwnLocation | null>(null);
  private readonly denied = signal(false);
  private watcher: number | null = null;

  readonly location = this._location.asReadonly();
  /**
   * Only a denied permission blocks. A browser that did not ask yet stays open, so the user can grant it.
   */
  readonly allowed = computed(() => !this.denied());

  constructor() {
    void this.followPermission();
  }

  /**
   * Starts to follow the location. The map calls this on each build, so more calls keep one watcher.
   */
  start(): void {
    if (this.watcher !== null || !this.hasGeolocation()) return;
    this.watcher = navigator.geolocation.watchPosition(
      (position) => {
        this.denied.set(false);
        this._location.set({
          lon: position.coords.longitude,
          lat: position.coords.latitude,
          accuracy: position.coords.accuracy,
        });
      },
      (failure) => {
        // Only a denied permission blocks the button. No signal is not a denial,
        // and the next attempt can succeed.
        if (failure.code === failure.PERMISSION_DENIED) this.denied.set(true);
        this._location.set(null);
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }

  stop(): void {
    if (this.watcher === null) return;
    navigator.geolocation.clearWatch(this.watcher);
    this.watcher = null;
  }

  /**
   * Old devices do not have geolocation, but the type says it exists. Thus the check runs at runtime.
   */
  private hasGeolocation(): boolean {
    const api = navigator.geolocation as Partial<Geolocation> | undefined;
    return typeof api?.watchPosition === 'function';
  }

  private async followPermission(): Promise<void> {
    try {
      const state = await navigator.permissions.query({ name: 'geolocation' });
      const read = (): void => {
        this.denied.set(state.state === 'denied');
      };
      read();
      state.addEventListener('change', read);
    } catch {
      // A browser without this query gives no permission state.
      // The button stays open; the first position fix decides.
    }
  }
}
