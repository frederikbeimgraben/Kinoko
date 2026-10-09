import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesSourcesComponent } from './species-sources.component';

const PROFILE = 'https://www.123pilzsuche.de/daten/details/Steinpilze.htm';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  sources: [
    { scope: 'profile', title: '123pilzsuche.de', url: PROFILE, checkedOn: '2026-09-12' },
    { scope: 'further', title: '123pilzsuche.de', url: `${PROFILE}/`, checkedOn: '2026-09-12' },
    {
      scope: 'further',
      title: 'Wikipedia',
      url: 'https://de.wikipedia.org/wiki/Steinpilz',
      checkedOn: '2026-09-12',
    },
  ],
});

describe('SpeciesSourcesComponent', () => {
  it('zeigt jede Adresse einmal, mit dem Host darunter und einem Knopf zum Öffnen', async () => {
    const { container } = await render(SpeciesSourcesComponent, { inputs: { species: STONE } });

    expect(container.querySelectorAll('app-row-group app-list-row')).toHaveLength(2);
    expect(screen.getAllByText('123pilzsuche.de')).toHaveLength(2);
    expect(screen.getByText('de.wikipedia.org')).toBeInTheDocument();
    expect(container.querySelectorAll('app-icon-button')).toHaveLength(2);
    await noViolations(container);
  });
});
