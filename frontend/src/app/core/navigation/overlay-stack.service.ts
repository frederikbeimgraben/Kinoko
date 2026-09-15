import { Injectable, OnDestroy } from '@angular/core';

/** Ebenen außerhalb der Route, jede mit einem Weg zurück über die Adresszeile. */
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

  /** Öffnet eine Ebene. Die Browser-Geste zurück ruft dann `onBack`. */
  open(onBack: () => void): void {
    this.layers.push(onBack);
    history.pushState({ overlayDepth: this.layers.length }, '');
  }

  /** Nimmt die oberste Ebene weg, für einen Tipp auf den eigenen Pfeil. */
  back(): void {
    if (this.layers.length === 0) return;
    this.layers.pop();
    this.guard = true;
    history.back();
  }

  /** Nimmt jede offene Ebene weg, für ein Blatt, das ganz schließt. */
  closeAll(): void {
    const depth = this.layers.length;
    if (depth === 0) return;
    this.layers.length = 0;
    this.guard = true;
    history.go(-depth);
  }
}
