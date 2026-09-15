import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import type { ColourChange } from '../../../core/api/models';
import { SpeciesColourChangeComponent } from './species-colour-change.component';

function term(slug: string, name: string): ColourChange['triggers'][number] {
  return { id: slug, slug, name, kind: 'trigger' };
}

const CHANGES: readonly ColourChange[] = [
  {
    part: 'tubes',
    kind: 'mechanical',
    from: { name: 'gelb', hex: '#cfd08a' },
    to: { name: 'blau', hex: '#3f6ea8' },
    speed: 'immediate',
    triggers: [term('pressure', 'Druck')],
  },
  {
    part: 'flesh',
    kind: 'mechanical',
    from: { name: 'weiß', hex: '#f4efe2' },
    to: { name: 'blau', hex: '#5b7fb0' },
    speed: '1min',
    triggers: [term('pressure', 'Druck'), term('cut', 'Anschnitt')],
  },
];

describe('SpeciesColourChangeComponent', () => {
  it('gruppiert die Verfärbung je Körperteil', async () => {
    const { container } = await render(SpeciesColourChangeComponent, { inputs: { changes: CHANGES } });

    expect(screen.getByText('Röhren')).toBeInTheDocument();
    expect(screen.getByText('Fleisch')).toBeInTheDocument();
    expect(container.querySelectorAll('app-colour-change')).toHaveLength(2);
    await noViolations(container);
  });

  it('nennt die Auslöser als Titel und Farben mit Dauer als Unterzeile', async () => {
    await render(SpeciesColourChangeComponent, { inputs: { changes: CHANGES } });

    expect(screen.getByText('Druck, Anschnitt')).toBeInTheDocument();
    expect(screen.getByText('gelb, dann blau · sofort')).toBeInTheDocument();
    expect(screen.getByText('weiß, dann blau · 1 min')).toBeInTheDocument();
  });

  it('trägt je Zeile eine Fläche mit Von und Nach', async () => {
    const { container } = await render(SpeciesColourChangeComponent, { inputs: { changes: CHANGES } });

    expect(container.querySelectorAll('.field')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'gelb bis blau' })).toBeInTheDocument();
  });

  it('zeigt ohne Verfärbung keine Karte', async () => {
    const { container } = await render(SpeciesColourChangeComponent, { inputs: { changes: [] } });

    expect(container.querySelectorAll('app-colour-change')).toHaveLength(0);
  });
});
