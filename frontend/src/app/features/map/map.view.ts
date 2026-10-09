import { Injectable, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TileService } from '../../core/tiles/tile.service';
import {
  findLayer,
  formatValue,
  histogramFor,
  joinNotes,
  layerWeek,
  matchingWeek,
  type Layer,
} from '../../core/tiles/layers';
import { NOW } from '../../core/tiles/now';
import { barShares, currentWeek, findWeek, isFuture, type ManifestWeek } from '../../core/tiles/manifest';
import type { SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';
import type { TimelineWeek } from '../../ui/timeline/timeline.component';
import { EntriesStore } from '../entries/entries.store';
import { SpeciesStore } from '../species/species.store';
import { CombinationStore } from './combination.store';
import { DEFAULT_LAYER, MapStore } from './map.store';
import { layerCaption, layerName } from './layer-name';
import { manifestState, mapData, type ManifestState } from './map-data';
import { speciesChoice } from './species-choice';

/** The values that the head and the body of the map read. One source for both devices. */
@Injectable({ providedIn: 'root' })
export class MapView {
  private readonly i18n = inject(I18nService);
  private readonly tiles = inject(TileService);
  private readonly now = inject(NOW);
  private readonly catalogue = inject(SpeciesStore);
  private readonly entries = inject(EntriesStore);
  readonly state = inject(MapStore);
  readonly combination = inject(CombinationStore);

  /** The numbers next to the switches of the layers button. */
  readonly entryCounts = computed(() => ({
    markers: this.entries.markers().length,
    zones: this.entries.zones().length,
    sharedFinds: this.entries.shared().length,
  }));

  readonly onLayer = computed(() => this.state.view() === 'layer');
  readonly onCombination = computed(() => this.state.view() === 'combination');

  /** The input layers, as the manifest gives them. */
  readonly layers = computed(() => this.tiles.layerList());

  readonly manifest = computed(() => this.tiles.manifests().get(this.slug()) ?? null);

  /** The states of the species manifest and the layers manifest. Without a species with a forecast, there is no species manifest. */
  private readonly states = computed<readonly ManifestState[]>(() => {
    const slug = this.slug();
    const tiles = this.tiles;
    const none = this.noSpecies() && !this.catalogue.loading();
    return [
      manifestState(this.manifest() !== null, none || tiles.missing().has(slug), tiles.failed().has(slug)),
      manifestState(tiles.layers() !== null, tiles.layersMissing(), tiles.layersFailed()),
    ];
  });

  private readonly data = computed(() => mapData(this.states()));
  readonly failed = computed(() => this.data().failed);
  readonly empty = computed(() => this.data().empty);
  readonly loading = computed(() => this.data().loading);

  /** The species manifest is not at the origin, or no species has a forecast. */
  readonly forecastMissing = computed(() => this.states()[0] === 'missing');

  /** The map shows the empty state: no map exists, or the forecast view has no forecast. */
  readonly noForecast = computed(
    () => this.empty() || (this.state.view() === 'forecast' && this.forecastMissing()),
  );

  /** Asks the server again for both manifests. */
  retry(): void {
    this.tiles.forget();
    void this.tiles.load(this.slug());
    void this.tiles.loadLayers();
  }

  readonly week = computed<ManifestWeek | null>(() => {
    const manifest = this.manifest();
    if (manifest === null) return null;
    const chosen = this.state.week();
    return (chosen !== null ? findWeek(manifest, chosen) : null) ?? currentWeek(manifest, this.now());
  });

  readonly weekKey = computed(() => {
    const week = this.week();
    return week === null ? null : layerWeek(week.year, week.week);
  });

  readonly weeks = computed<TimelineWeek[]>(() => {
    const manifest = this.manifest();
    if (manifest === null) return [];
    const shares = barShares(manifest);
    const today = this.now();
    return manifest.weeks.map((week, i) => ({
      year: week.year,
      week: week.week,
      share: shares[i],
      forecast: isFuture(week, today),
    }));
  });

  readonly activeWeek = computed(() => {
    const week = this.week();
    return week === null ? null : { year: week.year, week: week.week };
  });

  readonly weekText = computed(() => {
    const week = this.week();
    return week === null ? '' : this.i18n.translate('map.week.value', { week: week.week, year: week.year });
  });

  readonly layer = computed<Layer | null>(() => {
    const manifest = this.tiles.layers();
    if (manifest === null) return null;
    return (
      findLayer(manifest, this.state.layer()) ??
      findLayer(manifest, DEFAULT_LAYER) ??
      manifest.layers.at(0) ??
      null
    );
  });

  /** The week that a layer really shows. The weather data ends before the forecast. */
  readonly layerWeek = computed(() => {
    const layer = this.layer();
    return layer === null || layer.fixed ? null : matchingWeek(layer, this.weekKey());
  });

  /** A fixed layer has no week. The strip is then dimmed. */
  readonly fixedLayer = computed(() => this.onLayer() && this.layer()?.fixed === true);

  /** The credit of the mark: the fixed layer that needs a credit, or the combination with it. */
  readonly creditNote = computed<string | null>(() => {
    if (this.onCombination()) {
      return joinNotes(
        this.combination.factors().map((factor) => this.creditOf(this.layerFor(factor.source))),
      );
    }
    return this.creditOf(this.layer()) || null;
  });

  /** The credit of a raster base map. The vector map is OpenStreetMap. */
  readonly baseCredit = computed<string | null>(() => {
    const background = this.state.background();
    if (background === 'topo') return this.i18n.translate('map.basemap.terrainCredit');
    if (background === 'satellite') return this.i18n.translate('map.basemap.aerialAttribution');
    return null;
  });

  /** Only a fixed layer needs a credit, never a weekly layer. */
  private creditOf(layer: Layer | null): string {
    return layer !== null && layer.fixed && layer.note !== '' ? layer.note : '';
  }

  /** The map offers only species with a forecast. */
  readonly speciesChoices = computed<readonly SpeciesPickerEntry[]>(() =>
    this.catalogue
      .species()
      .filter((species) => species.forecastEnabled)
      .map((species) => speciesChoice(species, this.i18n)),
  );

  /** The selected species, else the first with a forecast. */
  readonly species = computed<SpeciesPickerEntry | null>(() => {
    const choices = this.speciesChoices();
    return choices.find((entry) => entry.value === this.state.species()) ?? choices.at(0) ?? null;
  });

  /** The species whose tiles the map loads. */
  readonly slug = computed(() => this.species()?.value ?? this.state.species());

  /** Without a species with a forecast, the map has no week and no ramp. */
  readonly noSpecies = computed(() => this.species() === null);

  readonly speciesName = computed(() => this.species()?.name ?? '');

  /** The desktop column always gives the species. The tabs are below it. */
  readonly speciesTitle = computed(() =>
    this.noSpecies() ? this.i18n.translate('map.species.choose') : this.speciesName(),
  );

  /** The name of a layer in the language of the app. */
  layerName(layer: Layer | null): string {
    return layer === null ? '' : layerName(layer, this.i18n);
  }

  /** The head gives what the map shows: the species, the layer or the combination. */
  readonly title = computed(() => {
    if (this.onCombination()) return this.i18n.translate('map.tab.combination');
    if (this.onLayer())
      return this.layer() === null ? this.i18n.translate('map.tab.layer') : this.layerName(this.layer());
    return this.speciesTitle();
  });

  /** Each source of a factor: the layers and the species. */
  readonly sources = computed<ReadonlyMap<string, Layer>>(() => {
    const all = new Map<string, Layer>();
    for (const entry of this.speciesChoices()) {
      const name = this.i18n.translate('map.factor.speciesLayer', { name: entry.name });
      const layer = this.tiles.speciesLayer(entry.value, name);
      if (layer !== null) all.set(entry.value, layer);
    }
    for (const layer of this.tiles.layerList()) all.set(layer.id, layer);
    return all;
  });

  readonly rampLabel = computed(() => {
    const layer = this.layer();
    if (this.onLayer()) return layer === null ? '' : layerCaption(layer, this.layerWeek(), this.i18n);
    // "Abgestuft" shows how well the factors agree, not a probability of a find.
    if (this.onCombination()) return this.i18n.translate('map.legend.factorMatch');
    return this.i18n.translate('map.legend.findProbability');
  });

  readonly rampFrom = computed(() => {
    const layer = this.layer();
    if (this.onLayer() && layer !== null) return formatValue(layer.low, layer, this.i18n.locale());
    return this.percent(0);
  });

  readonly rampTo = computed(() => {
    const layer = this.layer();
    if (this.onLayer() && layer !== null) return formatValue(layer.high, layer, this.i18n.locale());
    if (this.onCombination()) return this.percent(100);
    return this.percent(Math.round((this.manifest()?.top ?? 0) * 100));
  });

  /** The source of a factor, as the map knows it. */
  layerFor(source: string): Layer | null {
    return this.sources().get(source) ?? null;
  }

  /** The distribution of a source in the week of the map. */
  spread(layer: Layer): ReturnType<typeof histogramFor> {
    return histogramFor(layer, this.weekKey());
  }

  private percent(value: number): string {
    return `${new Intl.NumberFormat(this.i18n.locale()).format(value)} ${this.i18n.translate('unit.percent')}`;
  }
}
