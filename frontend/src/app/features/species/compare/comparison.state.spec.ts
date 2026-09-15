import { TestBed } from '@angular/core/testing';
import { catalogueProviders, catalogueReady } from '../../../testing/catalogue-double';
import { speciesBundle, speciesEntry } from '../../../testing/species-fixture';
import { ComparisonState } from './comparison.state';

const STONE = speciesEntry({ slug: 'steinpilz', name: 'Steinpilz', scientificName: 'Boletus edulis' });
const GALL = speciesEntry({
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  scientificName: 'Tylopilus felleus',
});

async function state(): Promise<ComparisonState> {
  TestBed.configureTestingModule({ providers: catalogueProviders(speciesBundle([STONE, GALL])) });
  await catalogueReady();
  return TestBed.inject(ComparisonState);
}

describe('ComparisonState', () => {
  it('beginnt ohne Wahl', async () => {
    expect((await state()).slugs()).toEqual([]);
  });

  it('nimmt eine Art auf', async () => {
    const held = await state();

    held.add('steinpilz');

    expect(held.slugs()).toEqual(['steinpilz']);
  });

  it('nimmt dieselbe Art nur einmal auf', async () => {
    const held = await state();

    held.add('steinpilz');
    held.add('steinpilz');

    expect(held.slugs()).toEqual(['steinpilz']);
  });

  it('gibt eine Art wieder frei', async () => {
    const held = await state();

    held.set(['steinpilz', 'gallenroehrling']);
    held.remove('steinpilz');

    expect(held.slugs()).toEqual(['gallenroehrling']);
  });

  it('setzt die Wahl neu, ohne eine Art doppelt zu führen', async () => {
    const held = await state();

    held.set(['steinpilz', 'steinpilz', 'gallenroehrling']);

    expect(held.slugs()).toEqual(['steinpilz', 'gallenroehrling']);
  });

  it('löst die Wahl in Arten des Katalogs auf', async () => {
    const held = await state();

    held.set(['gallenroehrling', 'steinpilz']);

    expect(held.species().map((one) => one.name)).toEqual(['Gallenröhrling', 'Steinpilz']);
  });

  it('lässt eine unbekannte Art aus', async () => {
    const held = await state();

    held.set(['steinpilz', 'pfifferling']);

    expect(held.species().map((one) => one.slug)).toEqual(['steinpilz']);
  });
});
