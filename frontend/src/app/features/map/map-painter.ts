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

/** So viele Wochen in jede Richtung werden vorgeladen. */
const LOOKAHEAD = 2;

/** Die Kennung der zusammengesetzten Quelle im Protokoll. */
const COMBINATION_SOURCE = 'kombi';

/** Die Kennung einer Ebene im Protokoll, damit sie nicht mit einer Art kollidiert. */
export function layerSourceId(layer: Layer): string {
  return `ebene-${layer.id}`;
}

/** Was die obere Wertebene zeigen soll. */
export interface UpperLayer {
  layer: Layer | null;
  combination: { rule: CombinationRule; colour: string; factors: readonly Factor[] } | null;
}

/** Legt die Wertebenen auf die Karte. Sie kennt MapLibre nur über den Adapter. */
export class MapPainter {
  constructor(
    private readonly adapter: MapAdapter,
    private readonly protocol: ValueProtocol,
  ) {}

  /** Meldet die Skala einer Art an den Färbe-Worker. */
  report(manifest: SpeciesManifest): void {
    this.protocol.report(speciesSource(manifest.slug, manifest.top, manifest.existing));
  }

  /** Die groben Stufen der Woche, noch bevor MapLibre steht. */
  prefetchOverview(manifest: SpeciesManifest, week: ManifestWeek): void {
    this.protocol.prefetch(
      manifest.slug,
      [week.tilePath],
      [...tilesAtZoom(manifest, manifest.zoomVon), ...tilesAtZoom(manifest, manifest.zoomVon + 1)],
    );
  }

  /** Die Vorhersage liegt unter der Ebene, wenn beide gefragt sind. */
  showForecast(manifest: SpeciesManifest | null, week: ManifestWeek | null, visible: boolean): void {
    if (manifest === null || week === null) return;
    this.adapter.showValue(
      'vorhersage',
      visible ? valueTemplate(manifest.slug, week.tilePath) : null,
      manifest.bounds,
      manifest.zoomVon,
      manifest.zoomBis,
    );
  }

  /** Nichts auf der oberen Ebene. */
  clearUpper(): void {
    this.adapter.showValue('ebene', null, MAX_BOUNDS, ZOOM_MIN, ZOOM_MAX);
  }

  showLayer(layer: Layer, manifest: LayersManifest, week: string | null): void {
    this.protocol.report({
      id: layerSourceId(layer),
      scale: { art: 'spanne', low: layer.low, high: layer.high },
      colors: FORECAST_RAMP,
      existing: layer.existing,
    });
    const folder = layerFolders(layer, week);
    this.adapter.showValue(
      'ebene',
      folder === null ? null : valueTemplate(layerSourceId(layer), folder),
      manifest.bounds,
      layer.zoomVon,
      layer.zoomBis,
    );
  }

  /** Die Kombination als eine Quelle. Ein neuer Schlüssel je Bedingung. */
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
      parts.push({ folder, bound: boundFor(factor, layer), existing: layer.existing });
      zoomFrom = Math.max(zoomFrom, layer.zoomVon);
      zoomTo = Math.min(zoomTo, layer.zoomBis);
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
      'ebene',
      valueTemplate(COMBINATION_SOURCE, key),
      manifest.bounds,
      zoomFrom,
      zoomTo,
    );
  }

  /** Lädt die Kacheln der Nachbarwochen, damit ein Wochenwechsel sofort steht. */
  prefetchNeighbours(
    manifest: SpeciesManifest | null,
    week: ManifestWeek | null,
    layer: Layer | null,
    layerWeekOf: (week: ManifestWeek) => string,
  ): void {
    const view = this.adapter.extent();
    if (manifest === null || week === null || view === null) return;
    const at = manifest.wochen.indexOf(week);
    const folders: string[] = [];
    const layerFoldersFound: string[] = [];
    for (let gap = 1; gap <= LOOKAHEAD; gap++) {
      for (const index of [at + gap, at - gap]) {
        const neighbour = manifest.wochen[index] as ManifestWeek | undefined;
        if (!neighbour) continue;
        folders.push(neighbour.tilePath);
        if (layer === null || layer.fixed) continue;
        const folder = layerFolders(layer, layerWeekOf(neighbour));
        if (folder !== null) layerFoldersFound.push(folder);
      }
    }
    const tiles = visibleTiles(view.extent, view.zoom, manifest.zoomVon, manifest.zoomBis);
    this.protocol.prefetch(manifest.slug, folders, tiles);
    if (layer !== null && layerFoldersFound.length > 0) {
      this.protocol.prefetch(layerSourceId(layer), layerFoldersFound, tiles);
    }
  }
}
