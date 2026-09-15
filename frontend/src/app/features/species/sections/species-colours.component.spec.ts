import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import type { ColourGroup } from '../../../core/api/models';
import { SpeciesColoursComponent } from './species-colours.component';

const GROUPS: readonly ColourGroup[] = [
  {
    part: 'cap',
    mode: 'gradient',
    colours: [
      { name: 'hellbraun', hex: '#e2c79a' },
      { name: 'dunkelbraun', hex: '#6b4423' },
    ],
  },
  { part: 'tubes', mode: 'distinct', colours: [{ name: 'weiß', hex: '#f0ece0' }] },
];

describe('SpeciesColoursComponent', () => {
  it('zeigt je Körperteil eine Zeile mit Namen und Fläche', async () => {
    const { container } = await render(SpeciesColoursComponent, { inputs: { groups: GROUPS } });

    expect(screen.getByText('Hut')).toBeInTheDocument();
    expect(screen.getByText('hellbraun bis dunkelbraun')).toBeInTheDocument();
    expect(container.querySelectorAll('app-colour-field')).toHaveLength(2);
    await noViolations(container);
  });

  it('blendet einen Verlauf weich und trennt mehrere Farben hart', async () => {
    const { container } = await render(SpeciesColoursComponent, { inputs: { groups: GROUPS } });

    const fields = container.querySelectorAll('app-colour-field .field');
    expect(fields[0].getAttribute('style')).toContain('linear-gradient');
  });
});
