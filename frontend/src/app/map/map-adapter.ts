import type { FeatureCollection } from 'geojson';
import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
  MapMouseEvent,
  MapSourceDataEvent,
  Subscription,
} from 'maplibre-gl';
import type { Viewbox } from './tile-grid';

/** Nur der Teil von MapLibre, den der Adapter braucht. */
export type MaplibreModule = Pick<
  typeof import('maplibre-gl'),
  'Map' | 'addProtocol' | 'removeProtocol' | 'setWorkerUrl'
>;

/** Wo der Worker von MapLibre liegt. */
export const WORKER_PATH = '/assets/maplibre/maplibre-gl-worker.mjs';

/** Wo das Stylesheet von MapLibre liegt. */
export const STYLE_PATH = '/assets/maplibre/maplibre-gl.css';

/** Haengt das Stylesheet in den Kopf. */
export function ensureStyles(head: HTMLHeadElement): void {
  if (head.querySelector(`link[href="${STYLE_PATH}"]`) !== null) return;
  const link = head.ownerDocument.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_PATH;
  head.append(link);
}

/** Südwest- und Nordostecke als [Länge, Breite]. */
export type Bounds = readonly [readonly [number, number], readonly [number, number]];

/** Zwei Wertebenen liegen übereinander: die Vorhersage unten, die Eingabe-Ebene darüber. */
export type Role = 'forecast' | 'layer';

export const ROLES: readonly Role[] = ['forecast', 'layer'];

/** Der freie Streifen der Karte: was Blatt, Navigation und Kopf verdecken. */
export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Ein eigenes Protokoll, das MapLibre kennen muss, bevor die erste Kachel fällt. */
export interface Protocol {
  name: string;
  resolve: (url: string) => Promise<{ data: ImageBitmap | ArrayBuffer }>;
}

export interface MapOptions {
  /** Die Quelle der Grundkarte, unten links auf der Karte. */
  style: string;
  centerPoint: readonly [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  maxBounds: Bounds;
  protocol: Protocol;
}

/** Die eigenen Ebenen über der Vorhersage, von unten nach oben. */
export const OBJECT_LAYERS = ['zonen', 'geteilteFunde', 'marker', 'funde', 'location'] as const;

/** Drehung und Neigung der Karte in Grad. */
export interface Rotation {
  bearing: number;
  pitch: number;
}

/** Ein Objekt unter dem Finger: seine Ebene, seine Kennung und sein Ort. */
export interface ObjectHit {
  layer: ObjectLayer;
  id: string;
  point: readonly [number, number];
}
export type ObjectLayer = (typeof OBJECT_LAYERS)[number];

/** Was die Kartenseite von der Karte braucht. */
export interface MapAdapter {
  /** Holt MapLibre schon, bevor die Karte gebraucht wird. */
  warmUp(): void;
  start(host: HTMLElement, options: MapOptions): Promise<void>;
  setStyle(style: string): void;
  /** Legt die Kacheln einer Rolle auf die Karte, ohne Flackern. */
  showValue(role: Role, template: string | null, bounds: Bounds, zoomFrom: number, zoomTo: number): void;
  /** Deckkraft einer Rolle, null als durchsichtig, eins als deckend. */
  setOpacity(role: Role, value: number): void;
  fitBounds(bounds: Bounds, padding: Padding): void;
  setPadding(padding: Padding): void;
  centerOn(point: readonly [number, number], zoom: number): void;
  extent(): { zoom: number; extent: Viewbox } | null;
  onMove(handler: () => void): void;
  destroy(): void;
  /** Der Ort in der Mitte der Karte. */
  center(): readonly [number, number] | null;
  /** Der Ort unter einem Punkt des Fensters, etwa unter dem Fadenkreuz. */
  pointAt(x: number, y: number): readonly [number, number] | null;
  /** Fährt zu einem Ort. */
  flyTo(centerPoint: readonly [number, number], zoom?: number): void;
  /** Legt die eigenen Objekte einer Ebene auf die Karte. */
  showObjects(layer: ObjectLayer, data: FeatureCollection): void;
  /** Nimmt eine Ebene von der Karte, ohne die anderen anzufassen. */
  hideObjects(layer: ObjectLayer): void;
  /** Ein Tipp auf ein Objekt. */
  onObjectSelect(handler: (layer: ObjectLayer, id: string) => void): void;
  /** Das Objekt unter einem Punkt der Fläche, für das lange Drücken. */
  objectAt(x: number, y: number): ObjectHit | null;
  /** Die rohe Karte für Terra Draw. */
  rawMap(): MapLibreMap | null;
  /** Drehung und Neigung der Karte. */
  rotation(): Rotation;
  /** Jede Drehung und jede Neigung der Karte. */
  onRotate(handler: () => void): void;
  /** Dreht nach Norden und stellt die Karte flach. */
  resetNorth(smooth: boolean): void;
  /** Ein Zeiger über der Karte, etwa `crosshair` beim Setzen eines Punktes. */
  setCursor(cursor: string): void;
  /** Ein Klick auf die Karte, der kein Objekt trifft. */
  onMapClick(handler: (point: readonly [number, number]) => void): () => void;
  /** Der Zeiger über der Karte, auch ohne Taste. */
  onPointerMove(handler: (point: readonly [number, number]) => void): () => void;
  /** Rechnet einen Ort in einen Punkt der Fläche um. */
  project(point: readonly [number, number]): { x: number; y: number } | null;
  /** Ein Druck auf die Karte, mit Maus oder Finger. */
  onPointerDown(handler: (point: readonly [number, number]) => void): () => void;
  /** Das Loslassen, mit Maus oder Finger. */
  onPointerUp(handler: () => void): () => void;
  /** Schaltet das Schieben der Karte aus, solange ein Zug einem Punkt gehört. */
  setDragPan(enabled: boolean): void;
}

/** Der Haken, über den ein Test die Karte genau setzt. */
export interface MapHandle {
  /** Der Ort unter einem Punkt des Fensters. */
  aimAt(x: number, y: number): [number, number];
  /** Schiebt die Karte so weit, dass der Ort unter dem Punkt liegt. */
  showAt(lon: number, lat: number, x: number, y: number, zoom?: number): void;
  /** Dreht und neigt die Karte, ohne Geste. */
  rotate(bearing: number, pitch: number): void;
}

/** So oft nähert sich die Karte dem Punkt an. Ein Schritt bleibt ungenau. */
const AIM_STEPS = 4;

interface MapWindow extends Window {
  pilzMap?: MapHandle;
}

/** Nach dieser Zeit wird die neue Woche auch ohne alle Kacheln sichtbar. */
const SWAP_DEADLINE = 1500;

/** So lange dreht die Karte zurück nach Norden. */
const ROTATE_DURATION = 400;

/** Der Zustand einer Rolle: welche Quelle liegt, welche wartet. */
interface RoleState {
  active: 0 | 1;
  template: string | null;
  space: { bounds: Bounds; zoomFrom: number; zoomTo: number } | null;
  swap: (() => void) | null;
  opacity: number;
}

function newRoleState(): RoleState {
  return { active: 0, template: null, space: null, swap: null, opacity: 1 };
}

/** Die beiden Ebenen-Namen einer Rolle. */
function layerName(role: Role, space: 0 | 1): string {
  return `wert-${role}-${space === 0 ? 'a' : 'b'}`;
}

/** Ein gerundeter Fund liegt irgendwo in dieser Masche, nicht auf dem Punkt. */
const ROUNDED_RADIUS = 18;
const POINT_RADIUS = 7;

/** Der eigene Standort trägt nie eine der sechs Objektfarben, sondern Blau. */
const LOCATION_COLOR = '#1a73e8';

function sourceFor(layer: ObjectLayer): string {
  return `objekte-${layer}`;
}

/** Die Schichten einer Ebene, in der Reihenfolge, in der sie liegen. */
function layerPaintLayers(layer: ObjectLayer): string[] {
  if (layer === 'zonen') return ['objekte-zonen-flaeche', 'objekte-zonen-linie'];
  if (layer === 'location') return ['objekte-location-kreis', 'objekte-location-punkt'];
  return [`objekte-${layer}-punkt`];
}

/** Wie eine Ebene aussieht. */
function paintLayersFor(layer: ObjectLayer): LayerSpecification[] {
  const source = sourceFor(layer);
  if (layer === 'zonen') {
    return [
      {
        id: 'objekte-zonen-flaeche',
        type: 'fill',
        source: source,
        paint: { 'fill-color': ['get', 'farbe'], 'fill-opacity': 0.18 },
      },
      {
        id: 'objekte-zonen-linie',
        type: 'line',
        source: source,
        paint: { 'line-color': ['get', 'farbe'], 'line-width': 2 },
      },
    ];
  }
  if (layer === 'location') {
    return [
      {
        id: 'objekte-location-kreis',
        type: 'fill',
        source: source,
        // Der Genauigkeitskreis kommt als Fläche in Grad, damit er beim Zoomen
        // mit dem Gelände wächst statt als fester Punktradius stehen zu bleiben.
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': LOCATION_COLOR, 'fill-opacity': 0.15 },
      },
      {
        id: 'objekte-location-punkt',
        type: 'circle',
        source: source,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': POINT_RADIUS,
          'circle-color': LOCATION_COLOR,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      },
    ];
  }
  if (layer === 'geteilteFunde') {
    return [
      {
        id: 'objekte-geteilteFunde-punkt',
        type: 'circle',
        source: source,
        paint: {
          'circle-radius': ['case', ['get', 'gerundet'], ROUNDED_RADIUS, POINT_RADIUS],
          'circle-color': ['get', 'farbe'],
          'circle-opacity': ['case', ['get', 'gerundet'], 0.25, 0.85],
          'circle-stroke-width': ['case', ['get', 'gerundet'], 0, 2],
          'circle-stroke-color': '#ffffff',
        },
      },
    ];
  }
  return [
    {
      id: `objekte-${layer}-punkt`,
      type: 'circle',
      source: source,
      paint: {
        'circle-radius': POINT_RADIUS,
        'circle-color': ['get', 'farbe'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    },
  ];
}

/** MapLibre hinter der Schnittstelle. */
export class MapLibreAdapter implements MapAdapter {
  private module: MaplibreModule | null = null;
  private protocolName: string | null = null;
  private map: MapLibreMap | null = null;
  private readonly states = new Map<Role, RoleState>(ROLES.map((role) => [role, newRoleState()]));
  /** Was auf den eigenen Ebenen liegt. */
  private readonly objects = new Map<ObjectLayer, FeatureCollection>();
  /** Die Klick-Anmeldungen je Ebene. */
  private readonly abos = new Map<ObjectLayer, Subscription[]>();
  private chosen: ((layer: ObjectLayer, id: string) => void) | null = null;
  /** Solange der Stil lädt, nimmt MapLibre keine Quelle an. */
  private styleReady = false;

  constructor(private readonly load: () => Promise<MaplibreModule>) {}

  warmUp(): void {
    // Der Modullader gibt beim zweiten Aufruf dasselbe Versprechen zurück.
    // Ein Anstoß vorab kostet darum nichts und spart einen Rahmen.
    void this.load();
  }

  async start(host: HTMLElement, options: MapOptions): Promise<void> {
    const module = await this.load();
    this.module = module;
    // Das Stylesheet steht vor der Karte: sonst waeren die Bedienelemente
    // einen Wimpernschlag lang ungestylt.
    ensureStyles(host.ownerDocument.head);
    module.setWorkerUrl(WORKER_PATH);
    // Das Protokoll steht vor der Karte, sonst fiele die erste Kachel ins Leere.
    module.addProtocol(options.protocol.name, (request) => options.protocol.resolve(request.url));
    this.protocolName = options.protocol.name;
    // Die Karte bleibt unter Verschluss, solange der Stil lädt. Davor lehnt
    // MapLibre jede Quelle ab.
    const map = new module.Map({
      container: host,
      style: options.style,
      center: [options.centerPoint[0], options.centerPoint[1]],
      zoom: options.zoom,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      maxBounds: options.maxBounds as [[number, number], [number, number]],
      // Der Hinweis der Karte steht als eigener Baustein auf der Seite: der
      // Stil bringt sonst seine eigenen Namen mit und schiebt sie ins Bild.
      attributionControl: false,
    });
    // `style.load` meldet den fertigen Stil. `load` wartet auf jede Kachel
    // und bleibt über einer langsamen Leitung lange aus.
    await new Promise<void>((done) => {
      map.once('style.load', () => {
        done();
      });
    });
    this.map = map;
    this.styleReady = true;
    // Ein Haken für den Board-Test: er schiebt die Karte um genaue Punkte.
    // Ein Zug mit der Maus trifft sie nicht.
    const frame = host.ownerDocument.defaultView as MapWindow | null;
    if (frame !== null) {
      frame.pilzMap = {
        aimAt: (x: number, y: number) => {
          const box = map.getContainer().getBoundingClientRect();
          const point = map.unproject([x - box.left, y - box.top]);
          return [point.lng, point.lat];
        },
        rotate: (bearing: number, pitch: number) => {
          map.jumpTo({ bearing, pitch });
        },
        showAt: (lon: number, lat: number, x: number, y: number, zoom?: number) => {
          const box = map.getContainer().getBoundingClientRect();
          map.jumpTo({ center: [lon, lat], zoom: zoom ?? map.getZoom() });
          for (let step = 0; step < AIM_STEPS; step += 1) {
            const shown = map.project([lon, lat]);
            map.panBy([shown.x - (x - box.left), shown.y - (y - box.top)], { duration: 0 });
          }
        },
      };
    }
  }

  setStyle(style: string): void {
    const map = this.map;
    if (!map) return;
    map.setStyle(style);
    this.styleReady = false;
    // Ein neuer Stil wirft alle eigenen Quellen weg. Sie kommen zurück, sobald
    // der Stil steht, sonst wären Vorhersage und Ebene nach dem Wechsel fort.
    map.once('style.load', () => {
      this.styleReady = true;
      for (const role of ROLES) {
        const state = this.state(role);
        const template = state.template;
        const space = state.space;
        state.active = 0;
        state.template = null;
        state.swap = null;
        if (template && space) this.showValue(role, template, space.bounds, space.zoomFrom, space.zoomTo);
      }
      for (const [layer, data] of this.objects) this.addObjectLayer(layer, data);
    });
  }

  showValue(role: Role, template: string | null, bounds: Bounds, zoomFrom: number, zoomTo: number): void {
    const map = this.map;
    const state = this.state(role);
    if (!map || template === state.template) return;
    // Ein noch offener Tausch wird zuerst zu Ende gebracht, sonst lägen drei
    // Wochen übereinander und keine wäre sichtbar.
    this.finishSwap(role);
    const alt = layerName(role, state.active);
    const next = layerName(role, state.active === 0 ? 1 : 0);
    state.template = template;
    if (template === null) {
      this.remove(alt);
      this.remove(next);
      state.space = null;
      return;
    }
    state.space = { bounds, zoomFrom, zoomTo };
    this.remove(next);
    map.addSource(next, {
      type: 'raster',
      tiles: [template],
      tileSize: 256,
      minzoom: zoomFrom,
      maxzoom: zoomTo,
      bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]],
      attribution: '',
    });
    map.addLayer(
      {
        id: next,
        type: 'raster',
        source: next,
        paint: {
          'raster-opacity': map.getLayer(alt) ? 0 : state.opacity,
          // Ohne diese beiden Nullen blendet MapLibre über 300 ms ein. Die alte
          // Woche ist da schon weg, und dazwischen bliebe die Karte leer.
          'raster-opacity-transition': { duration: 0, delay: 0 },
          'raster-fade-duration': 0,
          // Hochgerechnet läge ein weicher Rand weit neben dem Wald der
          // Grundkarte. Als Quadrat zeigt die Kachel ihre eigene Grenze.
          'raster-resampling': 'nearest',
        },
      },
      this.ueber(role),
    );
    state.active = state.active === 0 ? 1 : 0;
    if (!map.getLayer(alt)) return;
    this.swapAfterLoad(map, role, alt, next);
  }

  setOpacity(role: Role, value: number): void {
    const state = this.state(role);
    state.opacity = Math.min(Math.max(value, 0), 1);
    const map = this.map;
    if (!map || state.template === null) return;
    // Nur die sichtbare Ebene: die wartende steht auf 0 und käme sonst zu früh.
    const visible = layerName(role, state.active);
    if (map.getLayer(visible)) map.setPaintProperty(visible, 'raster-opacity', state.opacity);
  }

  fitBounds(bounds: Bounds, padding: Padding): void {
    const map = this.map;
    if (!map) return;
    // Das Polster gehört an die Karte, nicht an den Aufruf: `fitBounds` zöge es
    // sonst zweimal ab, einmal beim Rechnen und einmal beim Zeichnen.
    map.setPadding(padding);
    map.fitBounds(bounds as [[number, number], [number, number]], { duration: 0 });
  }

  setPadding(padding: Padding): void {
    this.map?.easeTo({ padding: padding, duration: 220 });
  }

  centerOn(point: readonly [number, number], zoom: number): void {
    this.map?.easeTo({ center: [point[0], point[1]], zoom, duration: 600 });
  }

  extent(): { zoom: number; extent: Viewbox } | null {
    const map = this.map;
    if (!map) return null;
    const bounds = map.getBounds();
    return {
      zoom: map.getZoom(),
      extent: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        ost: bounds.getEast(),
        nord: bounds.getNorth(),
      },
    };
  }

  onMove(handler: () => void): void {
    this.map?.on('moveend', handler);
  }

  destroy(): void {
    for (const role of ROLES) this.finishSwap(role);
    if (this.protocolName) this.module?.removeProtocol(this.protocolName);
    this.protocolName = null;
    this.map?.remove();
    this.map = null;
    this.module = null;
    for (const role of ROLES) this.states.set(role, newRoleState());
    this.objects.clear();
    for (const layer of this.abos.keys()) this.unsubscribeAll(layer);
  }

  private state(role: Role): RoleState {
    let state = this.states.get(role);
    if (!state) {
      state = newRoleState();
      this.states.set(role, state);
    }
    return state;
  }

  /** Vor welcher Ebene die neue liegt. */
  private ueber(role: Role): string | undefined {
    const map = this.map;
    if (!map) return undefined;
    if (role === 'forecast') {
      for (const space of [0, 1] as const) {
        const name = layerName('layer', space);
        if (map.getLayer(name)) return name;
      }
    }
    return this.firstObjectLayer(0);
  }

  /** Die unterste Objektschicht ab `from` in `OBJECT_LAYERS`, die schon liegt. */
  private firstObjectLayer(from: number): string | undefined {
    const map = this.map;
    if (!map) return undefined;
    for (const layer of OBJECT_LAYERS.slice(from)) {
      const found = layerPaintLayers(layer).find((id) => map.getLayer(id) !== undefined);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  /** Blendet die neue Woche ein, sobald ihre Kacheln liegen, und nimmt die alte weg. */
  private swapAfterLoad(map: MapLibreMap, role: Role, alt: string, next: string): void {
    const state = this.state(role);
    const done = (): void => {
      clearTimeout(deadline);
      map.off('sourcedata', onData);
      state.swap = null;
      map.setPaintProperty(next, 'raster-opacity', state.opacity);
      this.remove(alt);
    };
    const onData = (event: MapSourceDataEvent): void => {
      // Meldungen zur Quelle selbst kommen vor der ersten Kachel. Auf sie zu
      // hören hieße, die alte Woche vor der neuen wegzunehmen.
      if (event.sourceId !== next) return;
      if (event.sourceDataType === 'metadata' || event.sourceDataType === 'visibility') return;
      if (event.isSourceLoaded) done();
    };
    const deadline = setTimeout(done, SWAP_DEADLINE);
    state.swap = done;
    map.on('sourcedata', onData);
  }

  private finishSwap(role: Role): void {
    const state = this.state(role);
    const swap = state.swap;
    state.swap = null;
    swap?.();
  }

  center(): readonly [number, number] | null {
    const map = this.map;
    if (!map) return null;
    const center = map.getCenter();
    return [center.lng, center.lat];
  }

  /** Rechnet einen Punkt des Fensters in einen Ort um. */
  pointAt(x: number, y: number): readonly [number, number] | null {
    const map = this.map;
    if (!map) return null;
    const box = map.getContainer().getBoundingClientRect();
    const point = map.unproject([x - box.left, y - box.top]);
    return [point.lng, point.lat];
  }

  flyTo(centerPoint: readonly [number, number], zoom?: number): void {
    this.map?.easeTo({ center: [centerPoint[0], centerPoint[1]], zoom, duration: 400 });
  }

  showObjects(layer: ObjectLayer, data: FeatureCollection): void {
    this.objects.set(layer, data);
    this.addObjectLayer(layer, data);
  }

  hideObjects(layer: ObjectLayer): void {
    this.objects.delete(layer);
    this.unsubscribeAll(layer);
    for (const id of layerPaintLayers(layer)) this.remove(id);
    this.remove(sourceFor(layer));
  }

  onObjectSelect(handler: (layer: ObjectLayer, id: string) => void): void {
    this.chosen = handler;
  }

  objectAt(x: number, y: number): ObjectHit | null {
    const map = this.map;
    if (!map) return null;
    for (const layer of OBJECT_LAYERS) {
      if (layer === 'location') continue;
      const ids = layerPaintLayers(layer).filter((id) => map.getLayer(id) !== undefined);
      if (ids.length === 0) continue;
      const found = map.queryRenderedFeatures([x, y], { layers: ids });
      if (found.length === 0) continue;
      const id = found[0].properties['id'] as string | undefined;
      if (id === undefined) continue;
      const centre = map.unproject([x, y]);
      return { layer, id, point: [centre.lng, centre.lat] };
    }
    return null;
  }

  rawMap(): MapLibreMap | null {
    return this.map;
  }

  rotation(): Rotation {
    const map = this.map;
    if (!map) return { bearing: 0, pitch: 0 };
    return { bearing: map.getBearing(), pitch: map.getPitch() };
  }

  onRotate(handler: () => void): void {
    this.map?.on('rotate', handler);
    this.map?.on('pitch', handler);
  }

  resetNorth(smooth: boolean): void {
    this.map?.easeTo({ bearing: 0, pitch: 0, duration: smooth ? ROTATE_DURATION : 0 });
  }

  setCursor(cursor: string): void {
    const map = this.map;
    if (!map) return;
    map.getCanvas().style.cursor = cursor;
  }

  onMapClick(handler: (point: readonly [number, number]) => void): () => void {
    return this.onEvents(['click'], (event) => {
      handler([event.lngLat.lng, event.lngLat.lat]);
    });
  }

  onPointerMove(handler: (point: readonly [number, number]) => void): () => void {
    return this.onEvents(['mousemove', 'touchmove'], (event) => {
      handler([event.lngLat.lng, event.lngLat.lat]);
    });
  }

  onPointerDown(handler: (point: readonly [number, number]) => void): () => void {
    return this.onEvents(['mousedown', 'touchstart'], (event) => {
      handler([event.lngLat.lng, event.lngLat.lat]);
    });
  }

  onPointerUp(handler: () => void): () => void {
    return this.onEvents(['mouseup', 'touchend'], () => {
      handler();
    });
  }

  setDragPan(enabled: boolean): void {
    const map = this.map;
    if (!map) return;
    if (enabled) map.dragPan.enable();
    else map.dragPan.disable();
  }

  /** Meldet einen Zuhörer auf mehrere Ereignisse an und gibt sie zusammen frei. */
  private onEvents(kinds: readonly string[], run: (event: MapMouseEvent) => void): () => void {
    const map = this.map;
    if (!map) return () => undefined;
    const listener = (event: unknown): void => {
      run(event as MapMouseEvent);
    };
    for (const kind of kinds) map.on(kind as 'mousedown', listener);
    return () => {
      for (const kind of kinds) map.off(kind as 'mousedown', listener);
    };
  }

  project(point: readonly [number, number]): { x: number; y: number } | null {
    const map = this.map;
    if (!map) return null;
    const shown = map.project([point[0], point[1]]);
    return { x: shown.x, y: shown.y };
  }

  /** Schreibt die Daten in die Quelle der Ebene und legt Quelle und Schichten an, falls der Stil … */
  private addObjectLayer(layer: ObjectLayer, data: FeatureCollection): void {
    const map = this.map;
    // Die Daten liegen schon in `objects`; der Stil legt sie auf, sobald er steht.
    if (!map || !this.styleReady) return;
    const source = sourceFor(layer);
    const existing = map.getSource<GeoJSONSource>(source);
    if (existing) {
      // `setData` gibt ein Versprechen zurück; niemand wartet darauf, weil die
      // Karte selbst neu zeichnet, sobald die Quelle steht.
      void existing.setData(data);
      return;
    }
    this.unsubscribeAll(layer);
    map.addSource(source, { type: 'geojson', data: data });
    const abos: Subscription[] = [];
    const above = this.firstObjectLayer(OBJECT_LAYERS.indexOf(layer) + 1);
    for (const paintLayer of paintLayersFor(layer)) {
      map.addLayer(paintLayer, above);
      abos.push(
        map.on('click', paintLayer.id, (event) => {
          const id = event.features?.[0]?.properties?.['id'] as string | undefined;
          if (id !== undefined) this.chosen?.(layer, id);
        }),
      );
    }
    this.abos.set(layer, abos);
  }

  private unsubscribeAll(layer: ObjectLayer): void {
    for (const abo of this.abos.get(layer) ?? []) abo.unsubscribe();
    this.abos.delete(layer);
  }

  private remove(id: string): void {
    const map = this.map;
    if (!map) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }
}
