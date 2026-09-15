import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesEntry } from '../../testing/species-fixture';
import type { GroupKey } from './facets';
import { SpeciesGroupComponent } from './filter-group.component';
import { SpeciesFilterState } from './filter.state';

const WITH_TUBES = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  hymeniumType: 'tubes',
});

const WITH_GILLS = speciesEntry({
  slug: 'wiesenchampignon',
  name: 'Wiesenchampignon',
  scientificName: 'Agaricus campestris',
  hymeniumType: 'gills',
  edibility: 'edible',
});

const WITHOUT = speciesEntry({
  slug: 'bovist',
  name: 'Flaschenbovist',
  scientificName: 'Lycoperdon perlatum',
  edibility: 'inedible',
});

const BUNDLE = { items: [WITH_TUBES, WITH_GILLS, WITHOUT] };

async function build(group: GroupKey): Promise<{ container: Element; filter: SpeciesFilterState }> {
  const { container } = await render(SpeciesGroupComponent, {
    inputs: { group },
    providers: catalogueProviders(BUNDLE),
  });
  await catalogueReady();
  return { container, filter: TestBed.inject(SpeciesFilterState) };
}

describe('SpeciesGroupComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
  });

  it('führt jeden belegten Wert mit seiner Zahl', async () => {
    const { container } = await build('hymenium');

    await vi.waitFor(() => {
      expect(screen.getByText('Röhren')).toBeInTheDocument();
    });
    expect(screen.getByText('Lamellen')).toBeInTheDocument();
    expect(container.querySelectorAll('.row__count')).toHaveLength(2);
    await noViolations(container);
  });

  it('lässt einen Wert weg, den keine Art trägt', async () => {
    await build('hymenium');

    await vi.waitFor(() => {
      expect(screen.getByText('Röhren')).toBeInTheDocument();
    });
    expect(screen.queryByText('Poren')).not.toBeInTheDocument();
  });

  it('wählt einen Wert über sein Kästchen', async () => {
    const { filter } = await build('hymenium');
    await vi.waitFor(() => {
      expect(screen.getByText('Röhren')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('checkbox', { name: /Röhren/ }));

    expect([...filter.chosenIn('hymenium')]).toEqual(['tubes']);
  });

  it('stellt die Karte für fehlende Angaben nur bei einer Lücke', async () => {
    const { filter } = await build('hymenium');

    await vi.waitFor(() => {
      expect(screen.getByText('Arten ohne Angabe behalten')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('checkbox', { name: /Arten ohne Angabe behalten/ }));

    expect(filter.keeps('hymenium')).toBe(true);
  });

  it('lässt die Karte weg, solange jede Art eine Angabe trägt', async () => {
    await build('edibility');

    await vi.waitFor(() => {
      expect(screen.getByText('essbar')).toBeInTheDocument();
    });
    expect(screen.queryByText('Arten ohne Angabe behalten')).not.toBeInTheDocument();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesGroupComponent, {
      inputs: { group: 'hymenium' },
      providers: [...catalogueProviders(BUNDLE), EMPTY_CATALOG],
    });
    await catalogueReady();

    noGermanText(container);
  });
});
