import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SpeciesBundle } from '../core/api/models';
import { SpeciesState } from '../features/species/species.state';
import { OfflineStoreDouble, offlineProvider } from './offline-double';
import { SPECIES_BUNDLE } from './species-fixture';

/** Der Katalog liegt auf dem Gerät. Der Abgleich mit dem Dienst bleibt offen. */
export function catalogueProviders(
  bundle: SpeciesBundle | null = SPECIES_BUNDLE,
): (EnvironmentProviders | Provider)[] {
  const offline = new OfflineStoreDouble();
  if (bundle !== null) void offline.put('catalog', 'bundle', bundle);
  return [provideHttpClient(), provideHttpClientTesting(), offlineProvider(offline)];
}

/** Hält an, solange der Zustand den Katalog vom Gerät noch nicht zeigt. */
export async function catalogueReady(): Promise<SpeciesState> {
  const state = TestBed.inject(SpeciesState);
  void state.loadBundle();
  await vi.waitFor(() => {
    expect(state.species()).not.toHaveLength(0);
  });
  return state;
}
