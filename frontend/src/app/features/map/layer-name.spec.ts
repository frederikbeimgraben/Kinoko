import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { readLayers, type Layer } from '../../core/tiles/layers';
import { layerName, layerPeriod, layerTitle } from './layer-name';

const [RAIN, SPRUCE, OWN]: readonly Layer[] = readLayers({
  layers: {
    regen_4w: { label: 'Niederschlag 4 Wochen', unit: 'mm', static: false, low: 0, high: 100, tiles: 'x' },
    fichte: {
      label: 'Fichte',
      note: 'Thünen-Institut, CC BY 4.0',
      static: true,
      low: 0,
      high: 1,
      tiles: 'y',
    },
    neu: { label: 'Neue Ebene', static: false, low: 0, high: 1, tiles: 'z' },
  },
}).layers;

async function english(): Promise<I18nService> {
  const i18n = TestBed.inject(I18nService);
  i18n.setLocale('en');
  await vi.waitFor(() => {
    expect(i18n.locale()).toBe('en');
  });
  return i18n;
}

describe('layer names', () => {
  it('keeps the short German name of the manifest in German', () => {
    const i18n = TestBed.inject(I18nService);

    expect(layerName(RAIN, i18n)).toBe('Niederschlag 4 Wochen');
    expect(layerPeriod(SPRUCE, i18n)).toBe('zeitlich konstant');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('gives the name of a layer in the language of the app', async () => {
    const i18n = await english();

    expect(layerTitle(RAIN, i18n)).toBe('Precipitation, last 4 weeks');
    expect(layerName(RAIN, i18n)).toBe('Precipitation, last 4 weeks');
    expect(layerName(SPRUCE, i18n)).toBe('Spruce');
  });

  it('keeps the manifest name of a layer without a text key', async () => {
    const i18n = await english();

    expect(layerName(OWN, i18n)).toBe('Neue Ebene');
  });

  it('gives the span of a layer, never the credit of its source', async () => {
    const i18n = await english();

    expect(layerPeriod(RAIN, i18n)).toBe('per week');
    expect(layerPeriod(SPRUCE, i18n)).toBe('constant over time');
  });
});
