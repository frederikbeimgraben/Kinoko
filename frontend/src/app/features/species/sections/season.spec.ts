import { describe, expect, it } from 'vitest';
import type { SpeciesManifest } from '../../../core/tiles/manifest';
import { seasonData } from './season';

function week(year: number, number_: number, value: number): SpeciesManifest['weeks'][number] {
  return { year, week: number_, forecast: false, tilePath: '', mean: value, max: value, histogram: null };
}

function manifest(weeks: SpeciesManifest['weeks']): SpeciesManifest {
  return {
    slug: 'boletus-edulis',
    species: [],
    top: 0.32,
    bounds: [
      [0, 0],
      [1, 1],
    ],
    zoomFrom: 5,
    zoomTo: 8,
    existing: new Set(),
    weeks,
  };
}

describe('seasonData', () => {
  it('trennt das jüngste Jahr von den älteren', () => {
    const data = seasonData(
      manifest([week(2024, 1, 0.2), week(2025, 1, 0.6), week(2025, 2, 0.8), week(2023, 1, 0.4)]),
    );

    expect(data?.year).toBe(2025);
    expect(data?.week).toBe(2);
    expect(data?.current).toEqual([0.6, 0.8]);
    expect(data?.from).toBe(2023);
    expect(data?.to).toBe(2024);
  });

  it('mittelt die älteren Jahre je Kalenderwoche', () => {
    const data = seasonData(manifest([week(2023, 1, 0.2), week(2024, 1, 0.4), week(2025, 1, 1)]));

    expect(data?.past[0]).toBeCloseTo(0.3);
    expect(data?.past[1]).toBe(0);
  });

  it('bleibt ohne Wochen leer', () => {
    expect(seasonData(manifest([]))).toBeNull();
    expect(seasonData(null)).toBeNull();
  });
});
