import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesSensesComponent } from './species-senses.component';

function term(slug: string, name: string, kind: 'smell' | 'taste') {
  return { term: { id: slug, slug, name, kind }, fromExperience: false };
}

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  smellText: 'Frisch angenehm pilzig.',
  tasteText: 'Mild und nussig.',
  terms: [term('mushroomy', 'pilzig', 'smell'), term('mild', 'mild', 'taste')],
});

describe('SpeciesSensesComponent', () => {
  it('zeigt Marken und Satz für Geruch und Geschmack', async () => {
    const { container } = await render(SpeciesSensesComponent, { inputs: { species: STONE } });

    expect(screen.getByText('pilzig')).toBeInTheDocument();
    expect(screen.getByText('mild')).toBeInTheDocument();
    expect(screen.getByText('Frisch angenehm pilzig.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt einen Sinn ohne Angabe weg', async () => {
    const { container } = await render(SpeciesSensesComponent, {
      inputs: { species: speciesEntry({ ...STONE, tasteText: null, terms: [] }) },
    });

    expect(container.querySelectorAll('.sense__part')).toHaveLength(1);
  });
});
