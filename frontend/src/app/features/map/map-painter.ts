import { layerFolders, type Layer, type LayersManifest } from '../../core/tiles/layers';
import { tilesAtZoom, type ManifestWeek, type SpeciesManifest } from '../../core/tiles/manifest';
import { MAX_BOUNDS, ZOOM_MAX, ZOOM_MIN } from '../../map/background';
import type { MapAdapter } from '../../map/map-adapter';
import { visibleTiles } from '../../map/tile-grid';
import {
  speciesSource,
  valueTemplate,
  type CombinationSourcePart,
  type ValueProtocol,
} from '../../map/value-protocol';
import type { CombinationRule } from '../../map/value-colors';
import { FORECAST_RAMP } from '../../ui/ramp/ramp-colours';
import { boundFor, combinationKey, encodeFactors, type Factor } from './factors';

/** The number of weeks to prefetch in each direction. */
const LOOKAHEAD = 2;

/** The protocol ID of the combined source. */
const COMBINATION_SOURCE = 'combination';

/** The protocol ID of a layer. The prefix keeps it different from a species ID. */
export function layerSourceId(layer: Layer): string {
  return `ebene-${layer.id}`;
}

/** The data for the upper value layer. */
export interface UpperLayer {
  layer: Layer | null;
  combination: { rule: CombinationRule; colour: string; factors: readonly Factor[] } | null;
}

/** Puts the value layers on the map. It uses MapLibre only through the adapter. */
export class MapPainter {
  constructor(
    private readonly adapter: MapAdapter,
    private readonly protocol: ValueProtocol,
  ) {}

  /** Gives the scale of a species to the colouring worker. */
  report(manifest: SpeciesManifest): void {
    this.protocol.report(speciesSource(manifest.slug, manifest.top, manifest));
  }

  /** Prefetches the coarse levels of the week before MapLibre is ready. */
  prefetchOverview(manifest: SpeciesManifest, week: ManifestWeek): void {
    this.protocol.prefetch(
      manifest.slug,
      [week.tilePath],
      [...tilesAtZoom(manifest, manifest.zoomFrom), ...tilesAtZoom(manifest, manifest.zoomFrom + 1)],
    );
  }

  /** The forecast is below the layer when both are visible. */
  showForecast(manifest: SpeciesManifest | null, week: ManifestWeek | null, visible: boolean): void {
    if (manifest === null || week === null) return;
    this.adapter.showValue(
      'forecast',
      visible ? valueTemplate(manifest.slug, week.tilePath) : null,
      manifest.bounds,
      manifest.zoomFrom,
      manifest.zoomTo,
    );
  }

  clearUpper(): void {
    this.adapter.showValue('layer', null, MAX_BOUNDS, ZOOM_MIN, ZOOM_MAX);
  }

  showLayer(layer: Layer, manifest: LayersManifest, week: string | null): void {
    this.protocol.report({
      id: layerSourceId(layer),
      scale: { kind: 'range', low: layer.low, high: layer.high },
      colors: FORECAST_RAMP,
      existing: layer.existing,
      haveZoom: layer.haveZoom,
    });
    const folder = layerFolders(layer, week);
    this.adapter.showValue(
      'layer',
      folder === null ? null : valueTemplate(layerSourceId(layer), folder),
      manifest.bounds,
      layer.zoomFrom,
      layer.zoomTo,
    );
  }

  /** Shows the combination as one source. Each condition gets a new key. */
  showCombination(
    manifest: LayersManifest | null,
    sources: ReadonlyMap<string, Layer>,
    week: string | null,
    view: { rule: CombinationRule; colour: string; factors: readonly Factor[] },
  ): void {
    const parts: CombinationSourcePart[] = [];
    let zoomFrom = ZOOM_MIN;
    let zoomTo = ZOOM_MAX;
    for (const factor of view.factors) {
      const layer = sources.get(factor.source);
      if (!factor.active || !layer) continue;
      const folder = layerFolders(layer, week);
      if (folder === null) continue;
      parts.push({
        folder,
        bound: boundFor(factor, layer),
        existing: layer.existing,
        haveZoom: layer.haveZoom,
      });
      zoomFrom = Math.max(zoomFrom, layer.zoomFrom);
      zoomTo = Math.min(zoomTo, layer.zoomTo);
    }
    if (manifest === null || parts.length === 0 || zoomTo < zoomFrom) {
      this.clearUpper();
      return;
    }
    this.protocol.reportCombination({
      id: COMBINATION_SOURCE,
      rule: view.rule,
      colors: view.rule === 'intersection' ? [view.colour] : FORECAST_RAMP,
      parts,
    });
    const key = combinationKey([view.rule, encodeFactors(view.factors), week ?? 'fixed', view.colour]);
    this.adapter.showValue(
      'layer',
      valueTemplate(COMBINATION_SOURCE, key),
      manifest.bounds,
      zoomFrom,
      zoomTo,
    );
  }

  /** Loads the tiles of the adjacent weeks, so a week change shows immediately. */
  prefetchNeighbours(
    manifest: SpeciesManifest | null,
    week: ManifestWeek | null,
    layer: Layer | null,
    layerWeekOf: (week: ManifestWeek) => string,
  ): void {
    const view = this.adapter.extent();
    if (manifest === null || week === null || view === null) return;
    const at = manifest.weeks.indexOf(week);
    const folders: string[] = [];
    const layerFoldersFound: string[] = [];
    for (let gap = 1; gap <= LOOKAHEAD; gap++) {
      for (const index of [at + gap, at - gap]) {
        const neighbour = manifest.weeks[index] as ManifestWeek | undefined;
        if (!neighbour) continue;
        folders.push(neighbour.tilePath);
        if (layer === null || layer.fixed) continue;
        const folder = layerFolders(layer, layerWeekOf(neighbour));
        if (folder !== null) layerFoldersFound.push(folder);
      }
    }
    const tiles = visibleTiles(view.extent, view.zoom, manifest.zoomFrom, manifest.zoomTo);
    this.protocol.prefetch(manifest.slug, folders, tiles);
    if (layer !== null && layerFoldersFound.length > 0) {
      this.protocol.prefetch(layerSourceId(layer), layerFoldersFound, tiles);
    }
  }
}
