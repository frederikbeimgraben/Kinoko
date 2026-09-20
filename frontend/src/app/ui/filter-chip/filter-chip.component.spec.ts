import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FilterChipComponent } from './filter-chip.component';

describe('FilterChipComponent', () => {
  it('zeigt die Beschriftung als Knopf', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'essbar' },
    });

    expect(screen.getByRole('button', { name: 'essbar' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet die Wahl über den Knopf', async () => {
    const { fixture } = await render(FilterChipComponent, {
      inputs: { label: 'essbar' },
    });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'essbar' }));

    expect(calls).toBe(1);
  });

  it('trägt den gewählten Zustand über aria-pressed', async () => {
    await render(FilterChipComponent, { inputs: { label: 'essbar', on: true } });

    expect(screen.getByRole('button', { name: 'essbar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('zeigt ein Symbol, wenn eines gesetzt ist', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'Speisewert', icon: 'filter' },
    });

    expect(container.querySelector('app-svg-icon')).not.toBeNull();
  });

  it('zeigt einen Farbpunkt, wenn eine Farbe gesetzt ist', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'Braun', dot: '#7a5230' },
    });

    const dot = container.querySelector<HTMLElement>('.chip__dot');
    expect(dot).not.toBeNull();
    expect(dot?.style.background).toBe('rgb(122, 82, 48)');
  });

  it('zeigt keinen Pfeil ohne caret', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'Speisewert' },
    });

    expect(container.querySelectorAll('app-svg-icon')).toHaveLength(0);
  });

  it('zeigt einen Pfeil, wenn caret gesetzt ist', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'Speisewert', caret: true },
    });

    expect(container.querySelector('app-svg-icon')).not.toBeNull();
  });

  it('zeigt bei clear ein X statt des Knopfs für die Wahl', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'Schönbuch Nord', clear: true },
    });

    expect(container.querySelector('.chip__remove')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Schönbuch Nord' })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet das Entfernen über den X-Knopf', async () => {
    const { container, fixture } = await render(FilterChipComponent, {
      inputs: { label: 'Schönbuch Nord', clear: true },
    });
    let calls = 0;
    fixture.componentInstance.removed.subscribe(() => (calls += 1));
    const remove = container.querySelector<HTMLButtonElement>('.chip__remove');
    if (remove === null) throw new Error('Der X-Knopf steht nicht im Baum.');

    await userEvent.click(remove);

    expect(calls).toBe(1);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'edible', clear: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
