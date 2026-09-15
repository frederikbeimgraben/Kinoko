import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesTaxonomyComponent } from './species-taxonomy.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  genusName: 'Boletus',
  familyName: 'Boletaceae',
});

describe('SpeciesTaxonomyComponent', () => {
  it('führt Gattung und Familie als Verweis', async () => {
    const { container } = await render(SpeciesTaxonomyComponent, {
      providers: [provideRouter([])],
      inputs: { species: STONE },
    });

    expect(screen.getByRole('link', { name: 'Gattung' })).toHaveAttribute('href', '/taxonomie/genus/boletus');
    expect(screen.getByRole('link', { name: 'Familie' })).toHaveAttribute(
      'href',
      '/taxonomie/family/boletaceae',
    );
    await noViolations(container);
  });

  it('lässt die Familie weg, wo der Katalog keine kennt', async () => {
    await render(SpeciesTaxonomyComponent, {
      providers: [provideRouter([])],
      inputs: { species: speciesEntry({ ...STONE, familyName: null }) },
    });

    expect(screen.queryByRole('link', { name: 'Familie' })).toBeNull();
  });
});
