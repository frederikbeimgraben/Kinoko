import { Injectable, signal } from '@angular/core';

/** Ob die App im Blick ist. Die Karte pausiert im Hintergrund. */
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
