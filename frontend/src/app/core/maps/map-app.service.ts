import { Injectable, signal } from '@angular/core';

/** OpenStreetMap oder Google Maps, für „In Karten-App öffnen“ am Rechner. */
export type MapApp = 'osm' | 'google';

const STORAGE_KEY = 'pilzkarte.kartenApp';

/** Die Wahl der Karten-App. Sie wird je Gerät gespeichert. */
@Injectable({ providedIn: 'root' })
export class MapAppService {
  private readonly _choice = signal<MapApp>(this.read());

  readonly choice = this._choice.asReadonly();

  setChoice(choice: MapApp): void {
    this._choice.set(choice);
    this.save(choice);
  }

  private read(): MapApp {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'osm' || value === 'google') return value;
    } catch {
      // Gesperrter Speicher ist kein Fehler, dann gilt OpenStreetMap.
    }
    return 'osm';
  }

  private save(choice: MapApp): void {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Ohne Speicher gilt die Wahl nur für diese Sitzung.
    }
  }
}
