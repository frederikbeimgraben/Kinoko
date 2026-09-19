import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesSensesComponent } from './species-senses.component';

function term(slug: string, name: string, kind: 'smell' | 'taste') {
  return { term: { id: slug, slug, name, kind }, fromExperience: false };
}

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
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
  it('polstert den Textblock ringsum, oben schmaler als unten', async () => {
    const { container } = await render(SpeciesSensesComponent, { inputs: { species: STONE } });

    const body = styleOf(container.querySelector('.sense__body'));
    expect(body.paddingTop).toBe('12px');
    expect(body.paddingBottom).toBe('14px');
  });

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
