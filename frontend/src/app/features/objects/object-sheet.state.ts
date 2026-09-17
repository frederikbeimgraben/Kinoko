import { Injectable, inject } from '@angular/core';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { MapState, type ObjectKind } from '../map/map.state';

/** Welches Objekt über der Karte steht, mit dem Weg zurück über die Adresszeile. */
@Injectable({ providedIn: 'root' })
export class ObjectSheetState {
  private readonly stack = inject(OverlayStackService);
  private readonly map = inject(MapState);

  readonly open = this.map.object.asReadonly();

  /** Öffnet ein Objekt. Die Browser-Geste zurück schließt es wieder. */
  show(kind: ObjectKind, id: string): void {
    const first = this.map.object() === null;
    this.map.object.set({ kind, id });
    if (first) {
      this.stack.open(() => {
        this.map.object.set(null);
      });
    }
  }

  close(): void {
    if (this.map.object() === null) return;
    this.map.object.set(null);
    this.stack.back();
  }
}
