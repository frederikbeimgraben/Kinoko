import { Injectable, signal } from '@angular/core';

/** From this width, the sheet shows as a column next to the map (artboard `Desktop`). */
export const COLUMN_FROM = 1024;

/**
 * Tells if the window is wide enough for the column view. Sheet and map use this one signal.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly medium = matchMedia(`(min-width: ${String(COLUMN_FROM)}px)`);
  private readonly _wide = signal(this.medium.matches);

  readonly wide = this._wide.asReadonly();

  constructor() {
    this.medium.addEventListener('change', (event) => {
      this._wide.set(event.matches);
    });
  }
}
