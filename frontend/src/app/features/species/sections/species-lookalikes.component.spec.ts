import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
import type { Lookalike } from '../../../core/api/models';
import { SpeciesLookalikesComponent } from './species-lookalikes.component';

const LOOKALIKES: readonly Lookalike[] = [
  {
    slug: 'tylopilus-felleus',
    name: 'Gallenröhrling',
    scientificName: 'Tylopilus felleus',
    edibility: 'inedible',
    capColours: [{ name: 'hellbraun', hex: '#d8b98a' }],
    difference: null,
  },
];

describe('SpeciesLookalikesComponent', () => {
  it('zeigt je Verwechslung eine Zeile mit Namen und leerer Bildspalte', async () => {
    const { container } = await render(SpeciesLookalikesComponent, {
      inputs: { lookalikes: LOOKALIKES },
    });

    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    expect(container.querySelector('.lookalike__image')).not.toBeNull();
    expect(container.querySelector('app-private-image')).toBeNull();
    await noViolations(container);
  });

  it('meldet den Vergleich und die Artseite getrennt', async () => {
    const compared: string[] = [];
    const opened: string[] = [];
    await render(SpeciesLookalikesComponent, {
      inputs: { lookalikes: LOOKALIKES },
      on: {
        compared: (slug: string) => compared.push(slug),
        opened: (slug: string) => opened.push(slug),
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Vergleichen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gallenröhrling' }));

    expect(compared).toEqual(['tylopilus-felleus']);
    expect(opened).toEqual(['tylopilus-felleus']);
  });

  it('bleibt ohne Verwechslung leer', async () => {
    const { container } = await render(SpeciesLookalikesComponent, { inputs: { lookalikes: [] } });

    expect(container.querySelectorAll('app-list-row')).toHaveLength(0);
  });
});
