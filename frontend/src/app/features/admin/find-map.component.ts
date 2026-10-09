import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { ThemeStore } from '../../core/theme/theme.store';
import { styleFor } from '../../map/background';
import { WORKER_PATH, ensureStyles } from '../../map/map-adapter';
import { MapAttributionComponent } from '../../ui/map-attribution/map-attribution.component';
import { MapPinComponent } from '../../ui/map-pin/map-pin.component';

/** Near enough to see the forest path of a find. */
const ZOOM = 14;

/** A still map around a find, per the board `FindQueue`: the background map and a pin in the centre.
 * The pin is an element above the canvas, because the centre of the map is the find. */
@Component({
  selector: 'app-find-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapAttributionComponent, MapPinComponent],
  templateUrl: './find-map.component.html',
  styleUrl: './find-map.component.scss',
})
export class FindMapComponent {
  /** The find as [longitude, latitude]. */
  readonly point = input.required<readonly [number, number]>();
  readonly colour = input('#7a5230');

  private readonly theme = inject(ThemeStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private map: MapLibreMap | null = null;
  private gone = false;

  constructor() {
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => {
      this.gone = true;
      this.map?.remove();
    });
    effect(() => {
      const [lon, lat] = this.point();
      this.map?.jumpTo({ center: [lon, lat] });
    });
    effect(() => {
      this.map?.setStyle(styleFor('map', this.theme.effective()));
    });
  }

  /** MapLibre loads only with the first card. Without WebGL, the frame stays a plain surface. */
  private async start(): Promise<void> {
    try {
      const module = await import('maplibre-gl');
      if (this.gone) return;
      const host = this.canvas().nativeElement;
      ensureStyles(host.ownerDocument.head);
      module.setWorkerUrl(WORKER_PATH);
      const [lon, lat] = this.point();
      this.map = new module.Map({
        container: host,
        style: styleFor('map', this.theme.effective()),
        center: [lon, lat],
        zoom: ZOOM,
        interactive: false,
        attributionControl: false,
      });
    } catch {
      this.map = null;
    }
  }
}
