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
    expect(container.querySelector('.error__badge svg')).not.toBeNull();
    expect(container.querySelector('app-button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('nimmt ein eigenes Bild an und setzt es in ein Abzeichen von 56 px', async () => {
    const { container } = await render(ErrorStateComponent, {
      inputs: { text: 'Laden fehlgeschlagen', icon: 'lock' },
    });

    const badge = container.querySelector('.error__badge');
    if (badge === null) throw new Error('Das Abzeichen steht nicht im Baum.');
    const style = getComputedStyle(badge);
    expect(style.getPropertyValue('inline-size')).toBe('56px');
    expect(style.getPropertyValue('block-size')).toBe('56px');
    expect(style.borderRadius).toBe('50%');
  });

  it('meldet den erneuten Versuch nach draussen', async () => {
    const { fixture } = await render(ErrorStateComponent, {
      inputs: { text: 'Laden fehlgeschlagen' },
    });
    let calls = 0;
    fixture.componentInstance.retry.subscribe(() => (calls += 1));

    const button = screen.getByRole('button', { name: 'Erneut versuchen' });
    await userEvent.click(button);

    expect(calls).toBe(1);
    expect(button).toHaveClass('error__button', 'tap');
    expect(button).toHaveAttribute('data-press', 'scale');
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
