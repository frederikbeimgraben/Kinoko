import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
import type { SpeciesReaction } from '../species.store';
import { SpeciesReactionsComponent } from './species-reactions.component';

const POSITIVE: SpeciesReaction = {
  reagent: { slug: 'koh', name: 'Kalilauge' },
  reading: 'Huthaut weinrot',
  part: 'cap',
  location: null,
  result: 'positive',
  colour: { name: 'Weinrot', hex: '#7a1f3d' },
  contested: true,
  partlyConfirmed: false,
  sources: [{ label: 'Pilzkunde', url: 'https://pilzkunde.de', year: '2019' }],
};

const NEGATIVE: SpeciesReaction = {
  ...POSITIVE,
  reagent: { slug: 'feso4', name: 'Eisensulfat' },
  reading: 'keine Farbe',
  result: 'negative',
  colour: null,
  contested: false,
  partlyConfirmed: true,
  sources: [],
};

describe('SpeciesReactionsComponent', () => {
  it('shows one row per reaction under the section "Verfärbung"', async () => {
    const { container } = await render(SpeciesReactionsComponent, {
      inputs: { reactions: [POSITIVE, NEGATIVE] },
    });

    expect(screen.getByText('Verfärbung')).toBeInTheDocument();
    expect(screen.getByText('Kalilauge')).toBeInTheDocument();
    expect(screen.getByText('Huthaut weinrot')).toBeInTheDocument();
    expect(screen.getByText('Eisensulfat †')).toBeInTheDocument();
    await noViolations(container);
  });

  it('marks a contested reaction and names each swatch', async () => {
    await render(SpeciesReactionsComponent, { inputs: { reactions: [POSITIVE, NEGATIVE] } });

    expect(screen.getByRole('img', { name: 'umstritten' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'positiv, Weinrot' })).toHaveStyle({
      backgroundColor: 'rgb(122, 31, 61)',
    });
    expect(screen.getByRole('img', { name: 'negativ' })).toHaveClass('reaction__swatch--ring');
  });

  it('keeps the sources folded until the person opens them', async () => {
    await render(SpeciesReactionsComponent, { inputs: { reactions: [POSITIVE, NEGATIVE] } });

    expect(screen.queryByText('Pilzkunde')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Quellen der Reaktionen' }));

    expect(screen.getByText('Pilzkunde')).toBeInTheDocument();
    expect(screen.getByText('† teilweise bestätigt')).toBeInTheDocument();
  });

  it('shows nothing without colour changes and reactions', async () => {
    const { container } = await render(SpeciesReactionsComponent, { inputs: { reactions: [] } });

    expect(container.textContent.trim()).toBe('');
  });
});
