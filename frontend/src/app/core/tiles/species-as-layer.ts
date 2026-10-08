import { layerWeek, type Layer, type Histogram } from './layers';
import type { SpeciesManifest } from './manifest';

// Gives a forecast species the shape of an input layer, so the combination uses one code path.
// `low` is 0 and `high` is the species maximum. Without a unit, the value shows as a percent.
export function layerFromSpecies(manifest: SpeciesManifest, label: string, note = ''): Layer {
  const histograms = new Map<string, Histogram>();
  for (const week of manifest.weeks) {
    if (week.histogram) histograms.set(layerWeek(week.year, week.week), week.histogram);
  }
  return {
    id: manifest.slug,
    label,
    title: label,
    note,
    range: '',
    unit: '',
    fixed: false,
    low: 0,
    high: manifest.top,
    tilePath: tileRoot(manifest),
    zoomFrom: manifest.zoomFrom,
    zoomTo: manifest.zoomTo,
    haveZoom: manifest.haveZoom,
    offlineZoomTo: manifest.offlineZoomTo,
    existing: manifest.existing,
    weeks: manifest.weeks.map((week) => layerWeek(week.year, week.week)),
    histogram: null,
    histograms,
  };
}

/**
 * The folder above the weeks. It comes from the first week path, not the slug, so a rename only changes the manifest.
 */
function tileRoot(manifest: SpeciesManifest): string {
  const first = manifest.weeks.at(0)?.tilePath ?? '';
  const cut = first.lastIndexOf('/');
  return cut > 0 ? first.slice(0, cut) : first;
}
