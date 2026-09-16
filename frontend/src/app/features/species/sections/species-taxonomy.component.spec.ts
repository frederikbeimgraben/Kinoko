import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../../testing/i18n';
import { ANY_ROUTE } from '../../../testing/routes';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesTaxonomyComponent } from './species-taxonomy.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  genusName: 'Boletus',
  familyName: 'Boletaceae',
});

async function build(species = STONE): Promise<Element> {
  const { container } = await render(SpeciesTaxonomyComponent, {
    providers: [provideRouter(ANY_ROUTE)],
    inputs: { species },
  });
  return container;
}

describe('SpeciesTaxonomyComponent', () => {
  it('nennt Gattung und Familie', async () => {
    const container = await build();

    expect(screen.getByText('Einordnung')).toBeInTheDocument();
    expect(screen.getByText('Boletus · Boletaceae')).toBeInTheDocument();
    await noViolations(container);
  });

  it('nennt ohne Familie nur die Gattung', async () => {
    await build(speciesEntry({ ...STONE, familyName: null }));

    expect(screen.getByText('Boletus')).toBeInTheDocument();
  });

  it('führt zur Stufe der Gattung', async () => {
    await build();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await userEvent.click(screen.getByRole('button'));

    expect(navigate).toHaveBeenCalledWith(['/taxonomie', 'genus', 'boletus']);
  });

  it('bleibt ohne Gattung weg', async () => {
    const container = await build(speciesEntry({ ...STONE, genusName: '' }));

    expect(container.querySelector('app-list-row')).toBeNull();
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(SpeciesTaxonomyComponent, {
      providers: [provideRouter(ANY_ROUTE), EMPTY_CATALOG],
      inputs: { species: STONE },
    });

    noGermanText(container);
  });
});
