import { Directive, effect, inject, output } from '@angular/core';
import type { Feature, FeatureCollection } from 'geojson';
import type { Find, SharedFind, Marker, Zone } from '../../core/api/models';
import { LocationService, type OwnLocation } from '../../core/location/location.service';
import { circleAround } from '../../map/geo-circle';
import { MAP_ADAPTER } from '../../map/map.tokens';
import type { ObjectHit, ObjectLayer } from '../../map/map-adapter';
import { EntriesStore } from '../entries/entries.store';
import { colourHex } from '../entries/colors';
import { SpeciesStore } from '../species/species.store';
import { MapStore, type ObjectKind } from '../map/map.store';
import { AddEntryStore } from '../add-entry/add-entry.store';
import { ObjectSheetStore } from './object-sheet.store';

/** The point colours: an own find is `accent4`, a shared find of another person the muted `info`. */
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

/** The time in ms of a long press on an object. */
const HOLD = 500;

/** Puts the own markers, zones and finds and the shared finds on the map. A tap opens the object sheet. */
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
  private readonly eintraege = inject(EntriesStore);
  private readonly locating = inject(LocationService);
  private readonly species = inject(SpeciesStore);
  private readonly map = inject(MapStore);
  private readonly sheet = inject(ObjectSheetStore);
  private readonly addEntry = inject(AddEntryStore);

  /** A long press on an object: the point on the screen and the object. */
  readonly objectHeld = output<{ x: number; y: number }>();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private held: ObjectHit | null = null;

  /** The object of the last long press. */
  target(): ObjectHit | null {
    return this.held;
  }

  protected onPointerDown(event: PointerEvent): void {
    const host = event.currentTarget as HTMLElement;
    const box = host.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    this.stopHold();
    if (this.pointsPicked()) return;
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
    // Own finds always show: they are the reason to add entries.
    effect(() => {
      this.put('funde', true, () => this.finds(this.eintraege.finds()));
    });
    this.locating.follow();
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

  /** The open zone in the form shows its new outline. While its corners move, Terra Draw shows it instead. */
  private zones(zones: readonly Zone[]): FeatureCollection {
    const open = this.map.object();
    const reshaped = open?.kind === 'zone' ? open.id : null;
    const outline = this.sheet.outline();
    const moving = this.sheet.editingCorners();
    return collection(
      zones
        .filter((zone) => !(moving && zone.id === reshaped))
        .map((zone) => ({
          type: 'Feature',
          geometry: zone.id === reshaped && outline !== null ? outline : zone.polygon,
          properties: { id: zone.id, farbe: colourHex(zone.colour) },
        })),
    );
  }

  /** The id of the open object of this kind: its point gets the ring of `MapPin` with `on`. */
  private selected(kind: ObjectKind): string | null {
    const open = this.map.object();
    return open?.kind === kind ? open.id : null;
  }

  private markers(markers: readonly Marker[]): FeatureCollection {
    const selected = this.selected('marker');
    return collection(
      markers.map((entry) =>
        point(entry.id, entry.lon, entry.lat, {
          farbe: colourHex(entry.colour),
          selected: entry.id === selected,
        }),
      ),
    );
  }

  private finds(finds: readonly Find[]): FeatureCollection {
    const selected = this.selected('find');
    return collection(
      finds.map((find) =>
        point(find.id, find.lon, find.lat, { farbe: OWN_FIND, selected: find.id === selected }),
      ),
    );
  }

  /** The service gives only the shared finds of other persons. The own finds are on top. */
  private shared(finds: readonly SharedFind[]): FeatureCollection {
    return collection(
      finds.map((find) =>
        point(find.id, find.lon, find.lat, { farbe: FOREIGN_FIND, gerundet: this.coarse(find) }),
      ),
    );
  }

  /** The location of a protected species is rounded and shows as a pale area. */
  private coarse(find: SharedFind): boolean {
    if (find.speciesId === null) return false;
    return (this.species.entryById(find.speciesId)?.protection ?? 'none') !== 'none';
  }

  /** The point and the accuracy circle. Without a position, the layer stays empty. */
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

  /** While a step sets points or corners, each tap belongs to the step, also a tap on an object. */
  private pointsPicked(): boolean {
    return this.addEntry.running() || this.sheet.relocating() || this.sheet.editingCorners();
  }

  private open(layer: ObjectLayer, id: string): void {
    if (this.pointsPicked()) return;
    const kind: ObjectKind | null =
      layer === 'zonen' ? 'zone' : layer === 'marker' ? 'marker' : layer === 'funde' ? 'find' : null;
    if (kind === null) return;
    this.sheet.show(kind, id);
  }
}
