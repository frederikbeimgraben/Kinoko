import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../../testing/i18n';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesFeaturesComponent } from './species-features.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  edibility: 'edible',
  protection: 'none',
  marketable: true,
});

describe('SpeciesFeaturesComponent', () => {
  it('zeigt Speisewert, Schutz und Handel', async () => {
    const { container } = await render(SpeciesFeaturesComponent, { inputs: { species: STONE } });

    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(screen.getByText('nicht geschützt')).toBeInTheDocument();
    expect(screen.getByText('erlaubt')).toBeInTheDocument();
    await noViolations(container);
  });

  it('nennt den Handel begrenzt, wo die Art nicht marktfähig ist', async () => {
    await render(SpeciesFeaturesComponent, {
      inputs: { species: speciesEntry({ ...STONE, marketable: false }) },
    });

    expect(screen.getByText('nur begrenzt')).toBeInTheDocument();
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(SpeciesFeaturesComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { species: speciesEntry({ ...STONE, name: 'Penny bun' }) },
    });

    noGermanText(container);
  });
});
