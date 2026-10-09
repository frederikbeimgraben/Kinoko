import type { Map as MapLibreMap } from 'maplibre-gl';
import type { GeoPolygon } from '../../core/api/models';
import type { StepAction } from '../../ui/step-bar/step-bar.component';

/** The zoom of an open object: near enough to see the way, far enough to see where you are. */
export const ZOOM_OBJECT = 14;

/** The free edge around a zone outline, in pixels. The sides keep the corners clear of the map buttons. */
const ZONE_PADDING = { top: 48, bottom: 48, left: 88, right: 88 };

/** In the corner step, the step bar is over the map. The desktop map has no padding for it. */
const CORNER_PADDING = { ...ZONE_PADDING, bottom: 112 };

/** The two buttons of a step of an open object, per `StepBar.dc.html`: cancel and confirm. */
export function confirmActions(
  labels: { readonly cancel: string; readonly confirm: string },
  cancel: () => void,
  confirm: () => void,
): readonly StepAction[] {
  return [
    { label: labels.cancel, icon: 'close', variant: 'secondary', run: cancel },
    { label: labels.confirm, icon: 'check', variant: 'primary', run: confirm },
  ];
}

/** A zone shows its full outline, so "Umriss ändern" has each corner on the screen. */
export function fitZone(map: MapLibreMap | null, polygon: GeoPolygon, corners: boolean): void {
  const ring = polygon.coordinates[0];
  const lons = ring.map((point) => point[0]);
  const lats = ring.map((point) => point[1]);
  map?.fitBounds(
    [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    { padding: corners ? CORNER_PADDING : ZONE_PADDING, maxZoom: ZOOM_OBJECT, duration: 400 },
  );
}
