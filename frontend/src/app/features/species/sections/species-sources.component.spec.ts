import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import type { SpeciesReaction } from '../species.store';
import { SpeciesSourcesComponent } from './species-sources.component';

const PROFILE = 'https://www.123pilzsuche.de/daten/details/Steinpilze.htm';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  sources: [
    { scope: 'profile', title: '123pilzsuche', url: PROFILE, checkedOn: '2026-09-12' },
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
    expect(screen.getByText('123pilzsuche')).toBeInTheDocument();
    expect(screen.getByText('123pilzsuche.de')).toBeInTheDocument();
    expect(screen.getByText('de.wikipedia.org')).toBeInTheDocument();
    expect(container.querySelectorAll('app-icon-button')).toHaveLength(2);
    await noViolations(container);
  });

  it('öffnet die Quelle über die ganze Zeile', async () => {
    const open = vi.spyOn(globalThis, 'open').mockReturnValue(null);
    await render(SpeciesSourcesComponent, { inputs: { species: STONE } });

    await userEvent.click(screen.getByText('Wikipedia'));

    expect(open).toHaveBeenCalledWith('https://de.wikipedia.org/wiki/Steinpilz', '_blank', 'noreferrer');
    open.mockRestore();
  });

  it('nimmt die Quellen der Reaktionen auf, ohne den Titel unten zu wiederholen', async () => {
    const reactions: SpeciesReaction[] = [
      {
        reagent: { slug: 'koh', name: 'Kalilauge' },
        reading: 'gelb',
        part: 'flesh',
        location: null,
        result: 'positive',
        colour: null,
        contested: false,
        partlyConfirmed: false,
        sources: [
          { label: 'mykoweb.com', url: 'https://www.mykoweb.com/x', year: null },
          { label: 'Pilzkunde', url: null, year: '2019' },
        ],
      },
    ];
    const { container } = await render(SpeciesSourcesComponent, { inputs: { species: STONE, reactions } });

    expect(container.querySelectorAll('app-row-group app-list-row')).toHaveLength(4);
    expect(screen.getAllByText('mykoweb.com')).toHaveLength(1);
    expect(screen.getByText('2019')).toBeInTheDocument();
    expect(container.querySelectorAll('app-icon-button')).toHaveLength(3);
  });
});
