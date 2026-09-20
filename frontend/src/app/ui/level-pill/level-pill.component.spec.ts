import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { LevelPillComponent } from './level-pill.component';

describe('LevelPillComponent', () => {
  it('trägt das Wort und seine eigene Farbe', async () => {
    const { container } = await render(LevelPillComponent, {
      inputs: { text: 'tödlich giftig', colour: '#d2685f' },
    });

    expect(screen.getByText('tödlich giftig')).toBeInTheDocument();
    const pill = container.querySelector<HTMLElement>('.level');
    expect(pill?.style.getPropertyValue('--pilz-level-colour')).toBe('#d2685f');
    await noViolations(container);
  });

  it('trägt die Geometrie der Marke aus der Gestaltung', async () => {
    const { container } = await render(LevelPillComponent, {
      inputs: { text: 'essbar', colour: '#4f9d6f' },
    });

    const pill = container.querySelector<HTMLElement>('.level');
    if (pill === null) throw new Error('Die Marke steht nicht im Baum.');
    // Das globale Stilblatt mit --radius-md: 8px fehlt im Test. Geprüft
    // wird darum die Bindung an das Token, nicht der aufgelöste Wert.
    expect(getComputedStyle(pill).borderRadius).toBe('var(--radius-md)');
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(LevelPillComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { text: 'edible', colour: '#4f9d6f' },
    });

    noGermanText(container);
  });

  it('nimmt die Tonfarbe der Stufe, wenn eine Art angegeben ist', async () => {
    const { container } = await render(LevelPillComponent, {
      inputs: { text: 'essbar', kind: 'ok' },
    });

    expect(container.querySelector('.level')).toHaveClass('level--ok');
  });

  it('trägt keine Stufe ohne die Angabe', async () => {
    const { container } = await render(LevelPillComponent, {
      inputs: { text: 'essbar', colour: '#4f9d6f' },
    });

    const pill = container.querySelector('.level');
    expect(pill).not.toHaveClass('level--ok');
    expect(pill).not.toHaveClass('level--warn');
    expect(pill).not.toHaveClass('level--bad');
  });
});
