import { Directive, effect, inject, output } from '@angular/core';
import type { Feature, FeatureCollection } from 'geojson';
import type { Find, SharedFind, Marker, Zone } from '../../core/api/models';
import { LocationService, type OwnLocation } from '../../core/location/location.service';
import { circleAround } from '../../map/geo-circle';
import { MAP_ADAPTER } from '../../map/map.tokens';
import type { ObjectHit, ObjectLayer } from '../../map/map-adapter';
import { EntriesState } from '../entries/entries.state';
import { colourHex } from '../entries/colors';
import { SpeciesState } from '../species/species.state';
import { MapState, type ObjectKind } from '../map/map.state';

/**
 * Die Farben der Punkte aus `docs/mockups/bauen.py`: ein eigener Fund trägt
 * `accent4`, ein fremder geteilter das gedämpfte `info`. So sind die eigenen
 * Funde auf der Karte auf einen Blick von den fremden zu unterscheiden.
 */
const OWN_FIND = '#c8a25a';
const FOREIGN_FIND = '#185468';

function point(id: string, lon: number, lat: number, props: Record<string, string | boolean>): Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id, ...props },
  };
}

function collection(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

/**
 * Legt die eigenen Marker, Zonen und Funde sowie die geteilten Funde auf die
 * Karte und öffnet auf einen Tipp das Objekt-Blatt.
 *
 * Was liegt, entscheiden die drei Signale des Kartenzustands; der Ebenen-Knopf
 * aus B1 schaltet dieselben Signale.
 */
const HOLD = 500;

@Directive({
  selector: '[appMapObjects]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerEnd()',
    '(pointercancel)': 'onPointerEnd()',
    '(pointermove)': 'onPointerEnd()',
  },
})
export class MapObjectsDirective {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly eintraege = inject(EntriesState);
  private readonly locating = inject(LocationService);
  private readonly species = inject(SpeciesState);
  private readonly map = inject(MapState);

  /** Ein langer Druck auf ein Objekt: der Ort auf dem Bildschirm und das Ziel. */
  readonly objectHeld = output<{ x: number; y: number }>();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private held: ObjectHit | null = null;

  /** Das Objekt, auf das zuletzt lange gedrückt wurde. */
  target(): ObjectHit | null {
    return this.held;
  }

  protected onPointerDown(event: PointerEvent): void {
    const host = event.currentTarget as HTMLElement;
    const box = host.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    this.stopHold();
    this.timer = setTimeout(() => {
      const hit = this.adapter.objectAt(x, y);
      if (hit === null) return;
      this.held = hit;
      this.objectHeld.emit({ x: event.clientX, y: event.clientY });
    }, HOLD);
  }

  protected onPointerEnd(): void {
    this.stopHold();
  }

  private stopHold(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  constructor() {
    this.adapter.onObjectSelect((layer, id) => {
      this.open(layer, id);
    });

    effect(() => {
      this.put('zonen', this.map.showZones(), () => this.zones(this.eintraege.zones()));
    });
    effect(() => {
      this.put('marker', this.map.showMarkers(), () => this.markers(this.eintraege.markers()));
    });
    effect(() => {
      this.put('geteilteFunde', this.map.showSharedFinds(), () => this.shared(this.eintraege.shared()));
    });
    // Eigene Funde liegen immer: sie sind der Grund, warum jemand eintraegt.
    effect(() => {
      this.put('funde', true, () => this.finds(this.eintraege.finds()));
    });
    this.locating.start();
    effect(() => {
      const own = this.locating.location();
      this.put('location', own !== null, () => this.ownLocation(own));
    });
  }

  private put(layer: ObjectLayer, visible: boolean, create: () => FeatureCollection): void {
    if (!visible) {
      this.adapter.hideObjects(layer);
      return;
    }
    this.adapter.showObjects(layer, create());
  }

  private zones(zones: readonly Zone[]): FeatureCollection {
    return collection(
      zones.map((zone) => ({
        type: 'Feature',
        geometry: zone.polygon,
        properties: { id: zone.id, farbe: colourHex(zone.colour) },
      })),
    );
  }

  private markers(markers: readonly Marker[]): FeatureCollection {
    return collection(
      markers.map((entry) => point(entry.id, entry.lon, entry.lat, { farbe: colourHex(entry.colour) })),
    );
  }

  private finds(finds: readonly Find[]): FeatureCollection {
    return collection(finds.map((find) => point(find.id, find.lon, find.lat, { farbe: OWN_FIND })));
  }

  /** Der Dienst gibt nur fremde geteilte Funde her; die eigenen liegen darüber. */
  private shared(finds: readonly SharedFind[]): FeatureCollection {
    return collection(
      finds.map((find) =>
        point(find.id, find.lon, find.lat, { farbe: FOREIGN_FIND, gerundet: this.coarse(find) }),
      ),
    );
  }

  /** Der Ort einer geschützten Art kommt gerundet und liegt als blasse Fläche. */
  private coarse(find: SharedFind): boolean {
    if (find.speciesId === null) return false;
    return (this.species.entryById(find.speciesId)?.protection ?? 'none') !== 'none';
  }

  /** Punkt und Genauigkeitskreis. Ohne Ortung bleibt die Ebene leer. */
  private ownLocation(own: OwnLocation | null): FeatureCollection {
    if (own === null) return collection([]);
    return collection([
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circleAround([own.lon, own.lat], own.accuracy)] },
        properties: {},
      },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [own.lon, own.lat] }, properties: {} },
    ]);
  }

  private open(layer: ObjectLayer, id: string): void {
    const kind: ObjectKind | null =
      layer === 'zonen' ? 'zone' : layer === 'marker' ? 'marker' : layer === 'funde' ? 'find' : null;
    if (kind === null) return;
    this.map.object.set({ kind, id });
  }
}
