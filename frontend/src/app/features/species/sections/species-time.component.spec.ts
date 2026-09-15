import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesTimeComponent } from './species-time.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  periodStartMonth: 6,
  periodEndMonth: 10,
});

describe('SpeciesTimeComponent', () => {
  it('zeigt die Wachstumszeit als Spanne und als Band', async () => {
    const { container } = await render(SpeciesTimeComponent, { inputs: { species: STONE } });

    expect(screen.getByText('Juni bis Oktober')).toBeInTheDocument();
    expect(container.querySelector('app-year-band')).not.toBeNull();
    await noViolations(container);
  });

  it('bleibt ohne Zeitraum leer', async () => {
    const { container } = await render(SpeciesTimeComponent, {
      inputs: { species: speciesEntry({ ...STONE, periodStartMonth: null }) },
    });

    expect(container.querySelector('app-year-band')).toBeNull();
  });
});
