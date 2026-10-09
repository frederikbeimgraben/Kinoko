import { render, screen } from '@testing-library/angular';
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
    expect(screen.getByText('Hut · Huthaut weinrot')).toBeInTheDocument();
    expect(screen.getByText('Eisensulfat †')).toBeInTheDocument();
    await noViolations(container);
  });

  it('shows a reagent one time when the colour changes also name it', async () => {
    const { container } = await render(SpeciesReactionsComponent, {
      inputs: {
        reactions: [POSITIVE],
        changes: [
          {
            part: 'flesh',
            kind: 'reagent',
            from: null,
            to: { name: 'braun', hex: '#6b4423' },
            triggers: [{ id: 'k', slug: 'koh', name: 'Kalilauge', kind: 'trigger' }],
          },
          {
            part: 'tubes',
            kind: 'mechanical',
            from: null,
            to: { name: 'blau', hex: '#3a5f9e' },
            triggers: [{ id: 'p', slug: 'pressure', name: 'Druck', kind: 'trigger' }],
          },
        ],
      },
    });

    expect(container.querySelectorAll('app-list-row.reaction')).toHaveLength(2);
    expect(screen.getAllByText('Kalilauge')).toHaveLength(1);
    expect(screen.getByText('Druck')).toBeInTheDocument();
  });

  it('marks a contested reaction and names each swatch', async () => {
    await render(SpeciesReactionsComponent, { inputs: { reactions: [POSITIVE, NEGATIVE] } });

    expect(screen.getByRole('img', { name: 'umstritten' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'positiv, Weinrot' })).toHaveStyle({
      backgroundColor: 'rgb(122, 31, 61)',
    });
    expect(screen.getByRole('img', { name: 'negativ' })).toHaveClass('reaction__swatch--ring');
  });

  it('explains the marks of the rows below the group and leaves the sources to the section "Quellen"', async () => {
    await render(SpeciesReactionsComponent, { inputs: { reactions: [POSITIVE, NEGATIVE] } });

    expect(screen.getByText('Umstritten: Die Quellen widersprechen sich.')).toBeInTheDocument();
    expect(screen.getByText('† Nur teilweise bestätigt.')).toBeInTheDocument();
    expect(screen.queryByText('Pilzkunde')).toBeNull();
  });

  it('shows no legend without a marked row', async () => {
    const plain = { ...POSITIVE, contested: false };
    await render(SpeciesReactionsComponent, { inputs: { reactions: [plain] } });

    expect(screen.queryByText(/Umstritten|teilweise/)).toBeNull();
  });

  it('shows nothing without colour changes and reactions', async () => {
    const { container } = await render(SpeciesReactionsComponent, { inputs: { reactions: [] } });

    expect(container.textContent.trim()).toBe('');
  });
});
