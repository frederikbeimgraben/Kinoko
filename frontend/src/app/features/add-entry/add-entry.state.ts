import { Injectable, computed, inject, signal } from '@angular/core';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';

/** Ein Ort auf der Karte, als [Länge, Breite] wie im GeoJSON. */
export type Location = readonly [number, number];

/**
 * Die Schritte des Eintragens. Fund und Marker gehen denselben Weg: erst der
 * Ort mit dem Fadenkreuz, dann das Formular. Die Zone setzt statt einem Ort
 * ihre Eckpunkte.
 */
export type Step =
  'actions' | 'findLocation' | 'findForm' | 'markerLocation' | 'markerForm' | 'zoneDraw' | 'zoneForm';

/** So viele Eckpunkte braucht eine Fläche mindestens. */
export const CORNERS_MINIMUM = 3;

/**
 * Der Ablauf hinter dem Plus-Knopf.
 *
 * Er hält nur, wo man gerade steht und was schon eingesammelt ist. Was daraus
 * wird, entscheidet der {@link EntriesState}; so bleibt der Ablauf ohne
 * Netz prüfbar.
 */
@Injectable({ providedIn: 'root' })
export class AddEntryState {
  private readonly stack = inject(OverlayStackService);

  private readonly _step = signal<Step | null>(null);
  private readonly _location = signal<Location | null>(null);
  private readonly _ring = signal<readonly Location[]>([]);

  readonly step = this._step.asReadonly();
  /** Der Ort unter dem Fadenkreuz, sobald er übernommen ist. */
  readonly location = this._location.asReadonly();
  /** Die Eckpunkte der Zone, in der Reihenfolge des Setzens. */
  readonly ring = this._ring.asReadonly();

  readonly running = computed(() => this._step() !== null);
  /** Die Karte dunkelt hinter den Aktionen und hinter dem Fund ab. */
  readonly dark = computed(() => {
    const step = this._step();
    return step === 'actions' || step === 'findForm';
  });
  /** Ein Formular deckt die Karte ab: die schwebenden Knöpfe treten ab. */
  readonly onForm = computed(() => {
    const step = this._step();
    return step === 'findForm' || step === 'markerForm' || step === 'zoneForm';
  });
  readonly onActions = computed(() => this._step() === 'actions');
  readonly showsCrosshair = computed(() => {
    const step = this._step();
    return step === 'findLocation' || step === 'markerLocation' || step === 'zoneDraw';
  });
  readonly ringClosed = computed(() => this._ring().length >= CORNERS_MINIMUM);

  /** Der Ablauf legt einen Weg zurück an: die Geste zurück beendet ihn. */
  open(): void {
    this._step.set('actions');
    this.stack.open(() => {
      this.clear();
    });
  }

  startFind(): void {
    this._location.set(null);
    this._step.set('findLocation');
  }

  startMarker(): void {
    this._location.set(null);
    this._step.set('markerLocation');
  }

  startZone(): void {
    this._ring.set([]);
    this._step.set('zoneDraw');
  }

  /** Übernimmt den Ort unter dem Fadenkreuz und geht ins Formular. */
  adoptLocation(location: Location): void {
    this._location.set(location);
    this._step.update((step) => (step === 'markerLocation' ? 'markerForm' : 'findForm'));
  }

  addCorner(location: Location): void {
    this._ring.update((alt) => [...alt, location]);
  }

  removeLastCorner(): void {
    this._ring.update((alt) => alt.slice(0, -1));
  }

  /** Ersetzt den Ring, nachdem Terra Draw die Eckpunkte verschoben hat. */
  setRing(ring: readonly Location[]): void {
    this._ring.set(ring);
  }

  /** Schließt die Fläche ab. Unter drei Eckpunkten gibt es keine. */
  closeZone(): boolean {
    if (!this.ringClosed()) return false;
    this._step.set('zoneForm');
    return true;
  }

  /** Zurück vom Formular zum Ort oder zu den Eckpunkten. */
  back(): void {
    this._step.update((step) => {
      if (step === 'findForm') return 'findLocation';
      if (step === 'markerForm') return 'markerLocation';
      if (step === 'zoneForm') return 'zoneDraw';
      return null;
    });
  }

  stop(): void {
    const wasRunning = this._step() !== null;
    this.clear();
    if (wasRunning) this.stack.back();
  }

  private clear(): void {
    this._step.set(null);
    this._location.set(null);
    this._ring.set([]);
  }
}
