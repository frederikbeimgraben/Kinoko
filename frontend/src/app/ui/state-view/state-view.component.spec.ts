import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { StateViewComponent } from './state-view.component';

describe('StateViewComponent', () => {
  it('zeigt Bild und Satz, ohne Knopf', async () => {
    const { container } = await render(StateViewComponent, {
      inputs: { title: 'Keine Art passt zur Suche.' },
    });

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
    expect(container.querySelector('.state__blob svg')).not.toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('trägt keine Fehlerfärbung im Leerzustand', async () => {
    const { container } = await render(StateViewComponent, { inputs: { title: 'Noch kein Fund.' } });

    expect(container.querySelector('.state--error')).toBeNull();
  });

  it('trägt die Fehlerfärbung im Fehlerzustand', async () => {
    const { container } = await render(StateViewComponent, {
      inputs: { kind: 'error', title: 'Laden fehlgeschlagen', icon: 'warning' },
    });

    expect(container.querySelector('.state--error')).not.toBeNull();
  });

  it('zeigt einen Knopf mit der eigenen Beschriftung und meldet den Tipp', async () => {
    const { fixture } = await render(StateViewComponent, {
      inputs: { title: 'Laden fehlgeschlagen', action: 'Erneut versuchen' },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(calls).toBe(1);
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(StateViewComponent, {
      inputs: { title: 'no match', action: 'reset' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
