import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import type { Layer } from '../../core/tiles/layers';
import { CombinationState } from './combination.state';
import type { Factor } from './factors';
import { MapSurface } from './map-surface';
import type { Overlay } from './map-overlays.component';
import { MapView } from './map.view';

/** Welches Blatt über der Karte liegt, mit dem Weg zurück über die Adresszeile. */
@Injectable()
export class MapOverlayState {
  private readonly stack = inject(OverlayStackService);
  private readonly auth = inject(AuthService);
  private readonly view = inject(MapView);
  private readonly combination = inject(CombinationState);
  private readonly surface = inject(MapSurface);

  readonly overlay = signal<Overlay>(null);

  /** Der Titel im Kopf öffnet die Wahl, die zur Darstellung gehört. */
  openTitle(): void {
    if (this.view.onCombination()) this.set('combinations');
    else this.set(this.view.onLayer() ? 'layer' : 'species');
  }

  openFactorFor(source: string): void {
    const factor = this.combination.factors().find((entry) => entry.source === source) ?? null;
    this.surface.inProgress.set(factor);
    this.set('factor');
  }

  chooseSource(layer: Layer): void {
    this.surface.inProgress.set(this.combination.start(layer.id, layer.low, layer.high));
    this.set('factor');
  }

  applyFactor(factor: Factor): void {
    this.combination.apply(factor);
    this.close();
  }

  removeFactor(factor: Factor): void {
    this.combination.remove(factor);
    this.close();
  }

  /** Schließt das Blatt über der Karte und geht einen Schritt zurück. */
  close(): void {
    const wasOpen = this.overlay() !== null;
    this.overlay.set(null);
    this.surface.inProgress.set(null);
    if (wasOpen) this.stack.back();
  }

  /** Öffnet ein Blatt; das erste Blatt über der Karte legt einen Weg zurück an. */
  set(next: Overlay): void {
    const opening = this.overlay() === null && next !== null;
    this.overlay.set(next);
    if (opening) {
      this.stack.open(() => {
        this.overlay.set(null);
        this.surface.inProgress.set(null);
      });
    }
  }

  /** Ohne Konto führt der Knopf zuerst zur Anmeldung. */
  async requestSave(): Promise<void> {
    if (await this.auth.requestSignIn()) this.set('save');
  }
}
