import { Injectable, signal } from '@angular/core';

/** Tells if the app is visible. The map pauses when the app is in the background. */
@Injectable({ providedIn: 'root' })
export class VisibilityService {
  private readonly _visible = signal(document.visibilityState === 'visible');

  readonly visible = this._visible.asReadonly();

  constructor() {
    document.addEventListener('visibilitychange', () => {
      this._visible.set(document.visibilityState === 'visible');
    });
  }
}
