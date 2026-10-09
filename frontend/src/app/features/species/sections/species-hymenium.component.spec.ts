import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { CATALOGUE_TEXT } from '../../../testing/catalogue-text-double';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesHymeniumComponent } from './species-hymenium.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  hymeniumType: 'tubes',
  colours: [{ part: 'tubes', mode: 'distinct', colours: [{ name: 'weiß', hex: '#f0ece0' }] }],
});

const FIELD = speciesEntry({
  slug: 'agaricus-campestris',
  name: 'Wiesenchampignon',
  scientificName: 'Agaricus campestris',
  hymeniumType: 'gills',
  gillAttachment: 'free',
  gillSpacing: 'close',
  gillEdge: 'smooth',
});

describe('SpeciesHymeniumComponent', () => {
  it('nennt bei Röhren nur die Art und die Farbe', async () => {
    const { container } = await render(SpeciesHymeniumComponent, {
      providers: [CATALOGUE_TEXT],
      inputs: { species: STONE },
    });

    expect(screen.getByText('Röhren')).toBeInTheDocument();
    expect(container.querySelectorAll('app-row-group app-list-row')).toHaveLength(2);
    expect(container.querySelector('.hymenium__colour')?.textContent).toContain('weiß');
    await noViolations(container);
  });

  it('nennt bei Lamellen Ansatz, Stand und Schneide', async () => {
    await render(SpeciesHymeniumComponent, {
      providers: [CATALOGUE_TEXT],
      inputs: { species: FIELD },
    });

    expect(screen.getByText('frei')).toBeInTheDocument();
    expect(screen.getByText('eng')).toBeInTheDocument();
    expect(screen.getByText('glatt')).toBeInTheDocument();
  });

  it('bleibt ohne Fruchtschicht leer', async () => {
    const { container } = await render(SpeciesHymeniumComponent, {
      providers: [CATALOGUE_TEXT],
      inputs: { species: speciesEntry({ ...STONE, hymeniumType: null }) },
    });

    expect(container.querySelectorAll('app-list-row')).toHaveLength(0);
  });
});
