import { Injectable, OnDestroy } from '@angular/core';

/** Layers outside the route. The browser back gesture closes each layer. */
@Injectable({ providedIn: 'root' })
export class OverlayStackService implements OnDestroy {
  private readonly layers: (() => void)[] = [];
  private guard = false;
  private readonly onPopState = (): void => {
    if (this.guard) {
      this.guard = false;
      return;
    }
    this.layers.pop()?.();
  };

  constructor() {
    window.addEventListener('popstate', this.onPopState);
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.onPopState);
  }

  /** Opens a layer. The browser back gesture then calls `onBack`. */
  open(onBack: () => void): void {
    this.layers.push(onBack);
    history.pushState({ overlayDepth: this.layers.length }, '');
  }

  /** Removes the top layer when the user taps the in-app back arrow. */
  back(): void {
    if (this.layers.length === 0) return;
    this.layers.pop();
    this.guard = true;
    history.back();
  }

  /** Removes the top layer and keeps its history entry. The next route replaces that entry. */
  release(): void {
    this.layers.pop();
  }

  /** Removes all open layers when a sheet closes fully. */
  closeAll(): void {
    const depth = this.layers.length;
    if (depth === 0) return;
    this.layers.length = 0;
    this.guard = true;
    history.go(-depth);
  }
}
