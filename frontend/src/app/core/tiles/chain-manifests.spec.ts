import sample from './chain-manifests.sample.json';
import { readLayers, shareMet } from './layers';
import { readManifest } from './manifest';

/** Die Probe stammt aus `modell/src/pilze/manifest.py`. */
const LAYERS = readLayers(sample.layers);
const SPECIES = readManifest(sample.species, 'boletus-edulis');

describe('Manifeste der Kette', () => {
  it('liest die Verteilung einer festen Ebene', () => {
    const forest = LAYERS.layers.find((layer) => layer.id === 'wald');

    expect(forest?.histogram).not.toBeNull();
    expect(forest?.histogram?.classes).toHaveLength(41);
    expect(forest?.histogram?.shares).toHaveLength(40);
    expect(forest?.histogram?.shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 3);
  });

  it('liest je Woche eine Verteilung einer Wochenebene', () => {
    const rain = LAYERS.layers.find((layer) => layer.id === 'regen_4w');

    expect([...(rain?.histograms.keys() ?? [])]).toEqual(['2025W39', '2025W40']);
    expect(rain?.histograms.get('2025W40')?.classes[40]).toBeCloseTo(151.9, 3);
  });

  it('liest die Verteilung einer Woche der Art', () => {
    expect(SPECIES.weeks[0].histogram?.classes[0]).toBe(0);
    expect(SPECIES.weeks[0].histogram?.classes[40]).toBeCloseTo(SPECIES.top, 3);
  });

  it('beantwortet den Flächenanteil einer Spanne', () => {
    const forest = LAYERS.layers.find((layer) => layer.id === 'wald');
    const histogram = forest?.histogram;

    expect(histogram && shareMet(histogram, 0, 1)).toBeCloseTo(1, 3);
    expect(histogram && shareMet(histogram, 0, 0)).toBe(0);
  });
});
