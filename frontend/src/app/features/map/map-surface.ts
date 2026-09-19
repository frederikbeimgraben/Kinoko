import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocationService } from '../../core/location/location.service';
import { ThemeService } from '../../core/theme/theme.service';
import { TileService } from '../../core/tiles/tile.service';
import { layerWeek } from '../../core/tiles/layers';
import { GERMANY, MAX_BOUNDS, ZOOM_MAX, ZOOM_MIN, styleFor } from '../../map/background';
import type { Padding, Rotation } from '../../map/map-adapter';
import type { Viewbox } from '../../map/tile-grid';
import { MAP_ADAPTER, VALUE_WORKER } from '../../map/map.tokens';
import { ValueProtocol } from '../../map/value-protocol';
import type { Detent } from '../../ui/sheet/sheet.component';
import { CombinationState } from './combination.state';
import { MapPainter } from './map-painter';
import { MapState } from './map.state';
import { MapView } from './map.view';
import type { Factor } from './factors';

/** Die drei Rasten des Blatts in Punkten, aus den Boards. */
export const DETENTS = [149, 310, 480] as const;

/** Dieselben Rasten in der Schreibweise, die `app-sheet` erwartet. */
export const DETENT_SIZES = ['149px', '310px', '480px'] as const;

/** British Racing Green, falls das Theme keine Farbe hergibt. */
const MEAN_FALLBACK = '#004225';

/** Nah genug für einen Waldweg. */
export const ZOOM_LOCATION = 11;

/** Die Zeichenfläche: MapLibre, die Wertebenen und der freie Streifen. */
@Injectable()
export class MapSurface {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly protocol = new ValueProtocol(inject(VALUE_WORKER));
  private readonly painter = new MapPainter(this.adapter, this.protocol);
  private readonly theme = inject(ThemeService);
  private readonly tiles = inject(TileService);
  private readonly view = inject(MapView);
  private readonly state = inject(MapState);
  private readonly combination = inject(CombinationState);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly locating = inject(LocationService);

  private host: HTMLElement | null = null;
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  /** Der Faktor in Arbeit liegt oben, damit man sieht, was man einstellt. */
  readonly inProgress = signal<Factor | null>(null);

  private readonly _rotation = signal<Rotation>({ bearing: 0, pitch: 0 });
  /** Drehung und Neigung der Karte, für den Kompass. */
  readonly rotation = this._rotation.asReadonly();

  async start(host: HTMLElement, wide: boolean, onMove: () => void): Promise<void> {
    this.host = host;
    await this.adapter.start(host, {
      style: styleFor(this.state.background(), this.theme.effective()),
      centerPoint: [10.4, 51.2],
      zoom: ZOOM_MIN,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      maxBounds: MAX_BOUNDS,
      protocol: { name: 'wert', resolve: this.protocol.resolve },
    });
    this.adapter.fitBounds(GERMANY, this.padding(this.state.detent(), wide, this.state.overlayHeight()));
    this.adapter.onMove(onMove);
    this.adapter.onRotate(() => {
      this._rotation.set(this.adapter.rotation());
    });
    this._rotation.set(this.adapter.rotation());
    this._ready.set(true);
  }

  setStyle(): void {
    if (this._ready()) this.adapter.setStyle(styleFor(this.state.background(), this.theme.effective()));
  }

  /** Dreht die Karte zurück nach Norden und stellt sie flach. */
  resetNorth(): void {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.adapter.resetNorth(!still);
  }

  setOpacity(value: number, onLayer: boolean): void {
    if (!this._ready()) return;
    this.adapter.setOpacity('layer', onLayer ? value : 1);
    this.adapter.setOpacity('forecast', onLayer ? 1 : value);
  }

  setPadding(detent: Detent, wide: boolean, overlaid: number): void {
    if (this._ready()) this.adapter.setPadding(this.padding(detent, wide, overlaid));
  }

  /** Der Ausschnitt, den die Karte gerade zeigt. */
  extent(): { zoom: number; extent: Viewbox } | null {
    return this.adapter.extent();
  }

  centreOn(point: readonly [number, number]): void {
    this.adapter.centerOn(point, ZOOM_LOCATION);
  }

  /** Zentriert auf den eigenen Standort. Ohne Signal bleibt die Karte stehen. */
  locate(): void {
    const own = this.locating.location();
    if (own !== null) {
      this.centreOn([own.lon, own.lat]);
      return;
    }
    const api = navigator.geolocation as Partial<Geolocation> | undefined;
    if (typeof api?.getCurrentPosition !== 'function') {
      this.toasts.error(this.i18n.translate('map.locationDenied'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (place) => {
        this.centreOn([place.coords.longitude, place.coords.latitude]);
      },
      () => {
        this.toasts.error(this.i18n.translate('map.locationDenied'));
      },
    );
  }

  /** Legt Vorhersage und obere Ebene auf die Karte. */
  paint(): void {
    const manifest = this.view.manifest();
    const week = this.view.week();
    if (manifest !== null) this.painter.report(manifest);
    if (!this._ready()) return;
    const below = this.state.view() === 'forecast' || (this.view.onLayer() && this.state.forecastBelow());
    this.painter.showForecast(manifest, week, below);
    this.paintUpper();
    this.painter.prefetchNeighbours(manifest, week, this.view.layer(), (entry) =>
      layerWeek(entry.year, entry.week),
    );
  }

  destroy(): void {
    this.adapter.destroy();
    this.protocol.stop();
  }

  private paintUpper(): void {
    const layers = this.tiles.layers();
    const factor = this.inProgress();
    const shown = factor === null ? null : (this.view.sources().get(factor.source) ?? null);
    if (shown !== null && layers !== null) {
      this.painter.showLayer(shown, layers, this.view.weekKey());
      return;
    }
    if (this.view.onCombination()) {
      this.painter.showCombination(layers, this.view.sources(), this.view.weekKey(), {
        rule: this.combination.rule(),
        colour: this.intersectionColour(),
        factors: this.combination.factors(),
      });
      return;
    }
    const layer = this.view.layer();
    if (!this.view.onLayer() || layers === null || layer === null) {
      this.painter.clearUpper();
      return;
    }
    this.painter.showLayer(layer, layers, this.view.weekKey());
  }

  /** Die Farbe der Schnittmenge kommt aus dem Theme, nicht aus den Daten. */
  private intersectionColour(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : MEAN_FALLBACK;
  }

  /** Der freie Streifen der Karte: was Blatt und Navigation verdecken. */
  private padding(detent: Detent, wide: boolean, overlaid = 0): Padding {
    if (wide) return { top: 0, bottom: 0, left: 0, right: 0 };
    const height = this.host?.clientHeight ?? 0;
    const sheet = overlaid > 0 ? overlaid : Math.min(DETENTS[detent], height);
    return { top: 0, bottom: Math.round(sheet), left: 0, right: 0 };
  }
}
