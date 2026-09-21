import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesTraitsComponent } from './species-traits.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  traits: [
    { key: 'cap', text: 'Halbkugelig, später polsterförmig.' },
    { key: 'stem', text: 'Bauchig bis keulig, hell mit feinem weißem Netz.' },
    { key: 'flesh', text: 'Weiß, fest, unveränderlich.' },
  ],
});

describe('SpeciesTraitsComponent', () => {
  it('zeigt Hut, Stiel und Fleisch mit ihrem Satz', async () => {
    const { container } = await render(SpeciesTraitsComponent, { inputs: { species: STONE } });

    expect(screen.getByText('Halbkugelig, später polsterförmig.')).toBeInTheDocument();
    expect(screen.getByText('Bauchig bis keulig, hell mit feinem weißem Netz.')).toBeInTheDocument();
    expect(screen.getByText('Weiß, fest, unveränderlich.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt einen Teil ohne Satz weg', async () => {
    const { container } = await render(SpeciesTraitsComponent, {
      inputs: { species: speciesEntry({ ...STONE, traits: [STONE.traits[0]] }) },
    });

    expect(container.querySelectorAll('.trait__part')).toHaveLength(1);
  });

  it('zeigt keinen Abschnitt ohne einen Satz', async () => {
    const { container } = await render(SpeciesTraitsComponent, {
      inputs: { species: speciesEntry({ ...STONE, traits: [] }) },
    });

    expect(container.querySelector('.section__title')).toBeNull();
  });
});
