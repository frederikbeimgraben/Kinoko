import { Injectable, computed, signal } from '@angular/core';

/** Records the "no connection" banners on the screen. While one shows, a toast with the same message is not necessary. */
@Injectable({ providedIn: 'root' })
export class ConnectionNotice {
  private readonly banners = signal(0);

  /** True while a "no connection" banner shows. */
  readonly shown = computed(() => this.banners() > 0);

  add(): void {
    this.banners.update((count) => count + 1);
  }

  remove(): void {
    this.banners.update((count) => Math.max(0, count - 1));
  }
}
