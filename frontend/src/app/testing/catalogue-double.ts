import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SpeciesBundle } from '../core/api/models';
import { SpeciesStore } from '../features/species/species.store';
import { OfflineStoreDouble, offlineProvider } from './offline-double';
import { SPECIES_BUNDLE } from './species-fixture';

/** The catalogue is on the device. The comparison with the service stays open. */
export function catalogueProviders(
  bundle: SpeciesBundle | null = SPECIES_BUNDLE,
): (EnvironmentProviders | Provider)[] {
  const offline = new OfflineStoreDouble();
  if (bundle !== null) void offline.put('catalog', 'bundle', bundle);
  return [provideHttpClient(), provideHttpClientTesting(), offlineProvider(offline)];
}

/** Waits until the store shows the catalogue from the device. */
export async function catalogueReady(): Promise<SpeciesStore> {
  const state = TestBed.inject(SpeciesStore);
  void state.loadBundle();
  await vi.waitFor(() => {
    expect(state.species()).not.toHaveLength(0);
  });
  return state;
}
