import { Injectable, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TileService } from '../../core/tiles/tile.service';
import {
  findLayer,
  formatValue,
  histogramFor,
  layerWeek,
  matchingWeek,
  type Layer,
} from '../../core/tiles/layers';
import { NOW } from '../../core/tiles/now';
import { barShares, currentWeek, findWeek, type ManifestWeek } from '../../core/tiles/manifest';
import type { SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';
import type { TimelineWeek } from '../../ui/timeline/timeline.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE } from '../species/labels';
import { EntriesState } from '../entries/entries.state';
import { photoPath } from '../../core/api/models';
import { SpeciesState } from '../species/species.state';
import { CombinationState } from './combination.state';
import { DEFAULT_LAYER, MapState } from './map.state';

/** Die Werte, die Kopf und Inhalt der Karte lesen. Eine Quelle für beide Geräte. */
@Injectable({ providedIn: 'root' })
export class MapView {
  private readonly i18n = inject(I18nService);
  private readonly tiles = inject(TileService);
  private readonly now = inject(NOW);
  private readonly catalogue = inject(SpeciesState);
  private readonly entries = inject(EntriesState);
  readonly state = inject(MapState);
  readonly combination = inject(CombinationState);

  /** Die Zahlen neben den Schaltern des Ebenen-Knopfs. */
  readonly entryCounts = computed(() => ({
    markers: this.entries.marker().length,
    zones: this.entries.zones().length,
    sharedFinds: this.entries.shared().length,
  }));

  readonly onLayer = computed(() => this.state.view() === 'layer');
  readonly onCombination = computed(() => this.state.view() === 'combination');

  /** Die Eingabe-Ebenen, wie das Manifest sie nennt. */
  readonly layers = computed(() => this.tiles.layerList());

  readonly manifest = computed(() => this.tiles.manifests().get(this.state.species()) ?? null);

  /** Solange weder Manifest noch Ebenen da sind, zeigt die Karte ihr Skelett. */
  readonly loading = computed(() => this.manifest() === null && this.tiles.layers() === null);

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
    return manifest.weeks.map((week, i) => ({
      year: week.year,
      week: week.week,
      share: shares[i],
      forecast: week.forecast,
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

  /** Die Woche, die eine Ebene wirklich zeigt. Das Wetter endet vor der Prognose. */
  readonly layerWeek = computed(() => {
    const layer = this.layer();
    return layer === null || layer.fixed ? null : matchingWeek(layer, this.weekKey());
  });

  /** Eine feste Ebene kennt keine Woche; die Leiste tritt dann zurück. */
  readonly fixedLayer = computed(() => this.onLayer() && this.layer()?.fixed === true);

  /** Nur Arten mit Vorhersage bietet die Karte zur Wahl. */
  readonly speciesChoices = computed<readonly SpeciesPickerEntry[]>(() =>
    this.catalogue
      .species()
      .filter((species) => species.forecastEnabled)
      .map((species) => ({
        value: species.slug,
        name: species.name,
        latin: species.scientificName,
        levelText: this.i18n.translate(EDIBILITY_TEXT[species.edibility]),
        levelColour: EDIBILITY_TONE[species.edibility].colour,
        levelBackground: EDIBILITY_TONE[species.edibility].background,
        image: species.leadPhotoId ? photoPath(species.leadPhotoId, 'list') : null,
      })),
  );

  /** Die gewählte Art, sonst die erste mit Vorhersage. */
  readonly species = computed<SpeciesPickerEntry | null>(() => {
    const choices = this.speciesChoices();
    return choices.find((entry) => entry.value === this.state.species()) ?? choices.at(0) ?? null;
  });

  /** Die Art, deren Kacheln die Karte lädt. */
  readonly slug = computed(() => this.species()?.value ?? this.state.species());

  /** Ohne Art mit Vorhersage kennt die Karte weder Woche noch Rampe. */
  readonly noSpecies = computed(() => this.species() === null);

  readonly speciesName = computed(() => this.species()?.name ?? '');

  /** Die Spalte am Rechner nennt immer die Art: die Reiter stehen darunter. */
  readonly speciesTitle = computed(() =>
    this.noSpecies() ? this.i18n.translate('map.species.choose') : this.speciesName(),
  );

  /** Der Kopf nennt, was die Karte zeigt: die Art, die Ebene oder die Kombination. */
  readonly title = computed(() => {
    if (this.onCombination()) return this.i18n.translate('map.tab.combination');
    if (this.onLayer()) return this.layer()?.label ?? this.i18n.translate('map.tab.layer');
    return this.speciesTitle();
  });

  /** Jede Quelle, die ein Faktor nennen kann: die Ebenen und die Arten. */
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
    if (this.onLayer()) return this.layer()?.note ?? '';
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

  /** Die Quelle eines Faktors, wie die Karte sie kennt. */
  layerFor(source: string): Layer | null {
    return this.sources().get(source) ?? null;
  }

  /** Die Verteilung einer Quelle in der Woche der Karte. */
  spread(layer: Layer): ReturnType<typeof histogramFor> {
    return histogramFor(layer, this.weekKey());
  }

  private percent(value: number): string {
    return `${new Intl.NumberFormat(this.i18n.locale()).format(value)} ${this.i18n.translate('unit.percent')}`;
  }
}
