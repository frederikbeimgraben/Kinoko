import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesTraitsComponent } from './species-traits.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  traits: [
    { key: 'stem', text: 'Bauchig bis keulig, hell mit feinem weißem Netz.' },
    { key: 'cap', text: 'Halbkugelig, später polsterförmig.' },
    { key: 'flesh', text: 'Weiß, fest, unveränderlich.' },
    { key: 'tubes', text: 'Weiß, später olivgelb.' },
    { key: 'habitat', text: 'Bei Fichte und Buche.' },
    { key: 'smell', text: 'Angenehm.' },
  ],
});

describe('SpeciesTraitsComponent', () => {
  it('zeigt jeden Teil als Zeile einer Gruppe, in der Ordnung des Körpers', async () => {
    const { container } = await render(SpeciesTraitsComponent, { inputs: { species: STONE } });

    const rows = [...container.querySelectorAll('app-row-group app-list-row.trait')];
    expect(rows.map((row) => row.querySelector('.row__sub')?.textContent)).toEqual([
      'Halbkugelig, später polsterförmig.',
      'Weiß, später olivgelb.',
      'Bauchig bis keulig, hell mit feinem weißem Netz.',
      'Weiß, fest, unveränderlich.',
      'Bei Fichte und Buche.',
    ]);
    expect(screen.queryByText('Angenehm.')).toBeNull();
    await noViolations(container);
  });

  it('lässt einen Teil ohne Satz weg', async () => {
    const { container } = await render(SpeciesTraitsComponent, {
      inputs: { species: speciesEntry({ ...STONE, traits: [STONE.traits[0]] }) },
    });

    expect(container.querySelectorAll('app-list-row')).toHaveLength(1);
  });

  it('zeigt keinen Abschnitt ohne einen Satz', async () => {
    const { container } = await render(SpeciesTraitsComponent, {
      inputs: { species: speciesEntry({ ...STONE, traits: [] }) },
    });

    expect(container.querySelector('app-section')).toBeNull();
  });
});
