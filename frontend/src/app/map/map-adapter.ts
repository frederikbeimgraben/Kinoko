import type { FeatureCollection } from 'geojson';
import type {
  GeoJSONSource,
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
  Map as MapLibreMap,
  MapMouseEvent,
  MapSourceDataEvent,
  Subscription,
} from 'maplibre-gl';
import type { Viewbox } from './tile-grid';
import { MAP_PIN_BORDER_COLOUR, MAP_PIN_BORDER_WIDTH, MAP_PIN_RADIUS } from '../ui/map-pin/map-pin.constants';
import { ZONE_FILL_OPACITY, ZONE_STROKE_WIDTH } from '../ui/zone-shape/zone-shape.constants';

/** The part of MapLibre that the adapter uses. */
export type MaplibreModule = Pick<
  typeof import('maplibre-gl'),
  'Map' | 'addProtocol' | 'removeProtocol' | 'setWorkerUrl'
>;

export const WORKER_PATH = '/assets/maplibre/maplibre-gl-worker.mjs';

export const STYLE_PATH = '/assets/maplibre/maplibre-gl.css';

/** Adds the MapLibre stylesheet to the head once. */
export function ensureStyles(head: HTMLHeadElement): void {
  if (head.querySelector(`link[href="${STYLE_PATH}"]`) !== null) return;
  const link = head.ownerDocument.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_PATH;
  head.append(link);
}

/** South-west and north-east corner as [longitude, latitude]. */
export type Bounds = readonly [readonly [number, number], readonly [number, number]];

/** Two value layers: the forecast at the bottom, the input layer above it. */
export type Role = 'forecast' | 'layer';

export const ROLES: readonly Role[] = ['forecast', 'layer'];

/** The map area that the sheet, navigation and header cover. */
export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A custom protocol. MapLibre must know it before it loads the first tile. */
export interface Protocol {
  name: string;
  resolve: (url: string) => Promise<{ data: ImageBitmap | ArrayBuffer }>;
}

export interface MapOptions {
  style: string | StyleSpecification;
  centerPoint: readonly [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  maxBounds: Bounds;
  protocol: Protocol;
}

/** The object layers above the forecast, from bottom to top. */
export const OBJECT_LAYERS = ['zonen', 'geteilteFunde', 'marker', 'funde', 'location'] as const;

/** Map bearing and pitch in degrees. */
export interface Rotation {
  bearing: number;
  pitch: number;
}

/** An object under the pointer: its layer, its ID and its location. */
export interface ObjectHit {
  layer: ObjectLayer;
  id: string;
  point: readonly [number, number];
}
export type ObjectLayer = (typeof OBJECT_LAYERS)[number];

/** The map functions that the map page uses. */
export interface MapAdapter {
  /** Loads MapLibre before the map is necessary. */
  warmUp(): void;
  start(host: HTMLElement, options: MapOptions): Promise<void>;
  setStyle(style: string | StyleSpecification): void;
  /** Shows the tiles of a role on the map without flicker. */
  showValue(role: Role, template: string | null, bounds: Bounds, zoomFrom: number, zoomTo: number): void;
  /** Opacity of a role: 0 is transparent, 1 is opaque. */
  setOpacity(role: Role, value: number): void;
  fitBounds(bounds: Bounds, padding: Padding): void;
  setPadding(padding: Padding): void;
  centerOn(point: readonly [number, number], zoom: number): void;
  extent(): { zoom: number; extent: Viewbox } | null;
  onMove(handler: () => void): void;
  destroy(): void;
  /** Measures the canvas again, for example after the map was hidden without a layout change. */
  resize(): void;
  center(): readonly [number, number] | null;
  /** The location under a window point, for example under the crosshair. */
  pointAt(x: number, y: number): readonly [number, number] | null;
  flyTo(centerPoint: readonly [number, number], zoom?: number): void;
  showObjects(layer: ObjectLayer, data: FeatureCollection): void;
  /** Removes one layer from the map and keeps the other layers. */
  hideObjects(layer: ObjectLayer): void;
  /** A tap on an object. */
  onObjectSelect(handler: (layer: ObjectLayer, id: string) => void): void;
  /** The object under a canvas point, for the long press. */
  objectAt(x: number, y: number): ObjectHit | null;
  /** The raw map for Terra Draw. */
  rawMap(): MapLibreMap | null;
  rotation(): Rotation;
  /** Each change of map bearing or pitch. */
  onRotate(handler: () => void): void;
  /** Turns the map to north and sets the pitch to zero. */
  resetNorth(smooth: boolean): void;
  /** The language of the place names of the base map, for example `de`. Each new style keeps it. */
  setLabelLanguage(language: string): void;
  /** The map cursor, for example `crosshair` when the user sets a point. */
  setCursor(cursor: string): void;
  /** A click on the map that hits no object. */
  onMapClick(handler: (point: readonly [number, number]) => void): () => void;
  /** The pointer over the map, also without a pressed button. */
  onPointerMove(handler: (point: readonly [number, number]) => void): () => void;
  /** Converts a location to a canvas point. */
  project(point: readonly [number, number]): { x: number; y: number } | null;
  /** A press on the map, with mouse or finger. */
  onPointerDown(handler: (point: readonly [number, number]) => void): () => void;
  /** The release, with mouse or finger. */
  onPointerUp(handler: () => void): () => void;
  /** Stops map panning while a drag moves a point. */
  setDragPan(enabled: boolean): void;
}

/** The hook that tests use to set the map to an exact position. */
export interface MapHandle {
  /** The location under a window point. */
  aimAt(x: number, y: number): [number, number];
  /** Moves the map until the location is under the point. */
  showAt(lon: number, lat: number, x: number, y: number, zoom?: number): void;
  /** Sets bearing and pitch without a gesture. */
  rotate(bearing: number, pitch: number): void;
}

/** Number of approach steps to the point. One step is not accurate. */
const AIM_STEPS = 4;

interface MapWindow extends Window {
  pilzMap?: MapHandle;
}

/** After this time, the new week shows even if some tiles are missing. */
const SWAP_DEADLINE = 1500;

const ROTATE_DURATION = 400;

/** The state of a role: which source shows and which source waits. */
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

function layerName(role: Role, space: 0 | 1): string {
  return `wert-${role}-${space === 0 ? 'a' : 'b'}`;
}

/** A rounded find is somewhere in this grid cell, not on the point. */
const ROUNDED_RADIUS = 18;
const POINT_RADIUS = MAP_PIN_RADIUS;

/** The user location is always blue and never one of the six object colours. */
const LOCATION_COLOR = '#1a73e8';

function sourceFor(layer: ObjectLayer): string {
  return `objekte-${layer}`;
}

/** The paint layers of an object layer, in stacking order. */
function layerPaintLayers(layer: ObjectLayer): string[] {
  if (layer === 'zonen') return ['objekte-zonen-flaeche', 'objekte-zonen-linie'];
  if (layer === 'location') return ['objekte-location-kreis', 'objekte-location-punkt'];
  return [`objekte-${layer}-punkt`];
}

function paintLayersFor(layer: ObjectLayer): LayerSpecification[] {
  const source = sourceFor(layer);
  if (layer === 'zonen') {
    return [
      {
        id: 'objekte-zonen-flaeche',
        type: 'fill',
        source: source,
        paint: { 'fill-color': ['get', 'farbe'], 'fill-opacity': ZONE_FILL_OPACITY },
      },
      {
        id: 'objekte-zonen-linie',
        type: 'line',
        source: source,
        paint: { 'line-color': ['get', 'farbe'], 'line-width': ZONE_STROKE_WIDTH },
      },
    ];
  }
  if (layer === 'location') {
    return [
      {
        id: 'objekte-location-kreis',
        type: 'fill',
        source: source,
        // The accuracy circle is a polygon in degrees. Thus it scales with the
        // terrain on zoom and does not keep a fixed pixel radius.
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
          'circle-stroke-width': ['case', ['get', 'gerundet'], 0, MAP_PIN_BORDER_WIDTH],
          'circle-stroke-color': MAP_PIN_BORDER_COLOUR,
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
        'circle-stroke-width': MAP_PIN_BORDER_WIDTH,
        'circle-stroke-color': MAP_PIN_BORDER_COLOUR,
      },
    },
  ];
}

/** A place name in the given language, else the local name. */
export function labelField(language: string): ExpressionSpecification {
  return ['coalesce', ['get', `name:${language}`], ['get', 'name']];
}

/** MapLibre behind the adapter interface. */
export class MapLibreAdapter implements MapAdapter {
  private module: MaplibreModule | null = null;
  private protocolName: string | null = null;
  private map: MapLibreMap | null = null;
  private readonly states = new Map<Role, RoleState>(ROLES.map((role) => [role, newRoleState()]));
  /** The data on the object layers. */
  private readonly objects = new Map<ObjectLayer, FeatureCollection>();
  /** The click subscriptions for each layer. */
  private readonly abos = new Map<ObjectLayer, Subscription[]>();
  private chosen: ((layer: ObjectLayer, id: string) => void) | null = null;
  /** MapLibre refuses sources while the style loads. */
  private styleReady = false;
  private labelLanguage: string | null = null;

  constructor(private readonly load: () => Promise<MaplibreModule>) {}

  warmUp(): void {
    // The module loader gives the same promise on each call.
    // Thus an early call costs nothing and saves one frame.
    void this.load();
  }

  async start(host: HTMLElement, options: MapOptions): Promise<void> {
    const module = await this.load();
    this.module = module;
    // Add the stylesheet before the map. This prevents a short flash of
    // unstyled controls.
    ensureStyles(host.ownerDocument.head);
    module.setWorkerUrl(WORKER_PATH);
    // Add the protocol before the map. Otherwise the first tile request fails.
    module.addProtocol(options.protocol.name, (request) => options.protocol.resolve(request.url));
    this.protocolName = options.protocol.name;
    // Do not set `this.map` until the style is loaded.
    // Before that, MapLibre refuses each source.
    const map = new module.Map({
      container: host,
      style: options.style,
      center: [options.centerPoint[0], options.centerPoint[1]],
      zoom: options.zoom,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      maxBounds: options.maxBounds as [[number, number], [number, number]],
      // The page shows the attribution in its own component.
      // Otherwise the style adds its own attribution to the map.
      attributionControl: false,
    });
    // `style.load` fires when the style is ready. `load` waits for each tile
    // and can take a long time on a slow connection.
    await new Promise<void>((done) => {
      map.once('style.load', () => {
        done();
      });
    });
    this.map = map;
    this.styleReady = true;
    this.localise();
    // A hook for the board test: it moves the map by exact points.
    // A mouse drag is not accurate enough.
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

  setStyle(style: string | StyleSpecification): void {
    const map = this.map;
    if (!map) return;
    map.setStyle(style);
    this.styleReady = false;
    // A new style removes all custom sources. Add them again when the style
    // is ready. Otherwise forecast and layer disappear after the change.
    map.once('style.load', () => {
      this.styleReady = true;
      this.localise();
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
    // Complete an open swap first. Otherwise three weeks stack
    // and no week is visible.
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
          // Without these two zeros, MapLibre fades in over 300 ms. The old week
          // is already gone, so the map is empty during the fade.
          'raster-opacity-transition': { duration: 0, delay: 0 },
          'raster-fade-duration': 0,
          // Upscaled tiles give a soft edge far from the base map forest.
          // Square pixels keep the real tile boundary.
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
    // Only the visible layer. The waiting layer stays at 0 so it does not show too early.
    const visible = layerName(role, state.active);
    if (map.getLayer(visible)) map.setPaintProperty(visible, 'raster-opacity', state.opacity);
  }

  fitBounds(bounds: Bounds, padding: Padding): void {
    const map = this.map;
    if (!map) return;
    // Set the padding on the map, not on the call. Otherwise `fitBounds`
    // subtracts it twice: once to calculate and once to draw.
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

  resize(): void {
    this.map?.resize();
  }

  private state(role: Role): RoleState {
    let state = this.states.get(role);
    if (!state) {
      state = newRoleState();
      this.states.set(role, state);
    }
    return state;
  }

  /** The layer below which the new layer goes. */
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

  /** The lowest object layer from `from` in `OBJECT_LAYERS` that is on the map. */
  private firstObjectLayer(from: number): string | undefined {
    const map = this.map;
    if (!map) return undefined;
    for (const layer of OBJECT_LAYERS.slice(from)) {
      const found = layerPaintLayers(layer).find((id) => map.getLayer(id) !== undefined);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  /** Shows the new week when its tiles are loaded and removes the old week. */
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
      // Source events come before the first tile. If we use them,
      // the old week goes away before the new week shows.
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

  /** Converts a window point to a location. */
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

  setLabelLanguage(language: string): void {
    this.labelLanguage = language;
    this.localise();
  }

  /** The OpenFreeMap styles show English names. Each label of a place name takes the app language first. */
  private localise(): void {
    const map = this.map;
    const language = this.labelLanguage;
    if (!map || !this.styleReady || language === null) return;
    for (const layer of map.getStyle().layers) {
      if (layer.type !== 'symbol') continue;
      const field: unknown = map.getLayoutProperty(layer.id, 'text-field');
      if (field !== undefined && JSON.stringify(field).includes('"name')) {
        map.setLayoutProperty(layer.id, 'text-field', labelField(language));
      }
    }
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

  /** Adds one listener to many events and gives one function that removes all. */
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

  /** Writes the data to the layer source. Adds source and paint layers if they are missing. */
  private addObjectLayer(layer: ObjectLayer, data: FeatureCollection): void {
    const map = this.map;
    // The data is in `objects`. The style load adds it later.
    if (!map || !this.styleReady) return;
    const source = sourceFor(layer);
    const existing = map.getSource<GeoJSONSource>(source);
    if (existing) {
      // Do not wait for the `setData` promise.
      // The map draws again when the source is ready.
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
