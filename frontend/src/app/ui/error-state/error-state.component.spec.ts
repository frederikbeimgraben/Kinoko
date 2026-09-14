import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  it('zeigt Bild, Satz und den Knopf zum erneuten Versuch', async () => {
    const { container } = await render(ErrorStateComponent, {
      inputs: { text: 'Laden fehlgeschlagen' },
    });

    expect(screen.getByText('Laden fehlgeschlagen')).toBeInTheDocument();
    expect(container.querySelector('.error__image svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('nimmt ein eigenes Bild an', async () => {
    const { container } = await render(ErrorStateComponent, {
      inputs: { text: 'Laden fehlgeschlagen', icon: 'lock' },
    });

    expect(container.querySelector('.error__image')).not.toBeNull();
  });

  it('meldet den erneuten Versuch nach draussen', async () => {
    const { fixture } = await render(ErrorStateComponent, {
      inputs: { text: 'Laden fehlgeschlagen' },
    });
    let calls = 0;
    fixture.componentInstance.retry.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(calls).toBe(1);
  });

  it('löst mit der Leertaste aus', async () => {
    const { fixture } = await render(ErrorStateComponent, {
      inputs: { text: 'Laden fehlgeschlagen' },
    });
    let calls = 0;
    fixture.componentInstance.retry.subscribe(() => (calls += 1));

    screen.getByRole('button', { name: 'Erneut versuchen' }).focus();
    await userEvent.keyboard(' ');

    expect(calls).toBe(1);
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(ErrorStateComponent, {
      inputs: { text: 'loading failed' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
