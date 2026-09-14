import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FloatingButtonComponent } from './floating-button.component';

describe('FloatingButtonComponent', () => {
  it('trägt seine Beschriftung und meldet den Klick', async () => {
    const { container, fixture } = await render(FloatingButtonComponent, {
      inputs: { icon: 'layers', label: 'Ebenen' },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Ebenen' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('kennt eine primäre Variante', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'plus', label: 'Melden', variant: 'primary' },
    });

    expect(container.querySelector('.floating--primary')).not.toBeNull();
  });

  it('sperrt sich, ohne zu verschwinden', async () => {
    const { container, fixture } = await render(FloatingButtonComponent, {
      inputs: { icon: 'plus', label: 'Melden', disabled: true },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    const button = screen.getByRole('button', { name: 'Melden' });
    expect(button).toBeDisabled();
    expect(container.querySelector('.floating')).not.toBeNull();
    expect(calls).toBe(0);
  });

  it('trägt Tippfläche und Druckzustand', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'plus', label: 'Melden' },
    });

    const button = container.querySelector('button');
    expect(button).toHaveClass('tap');
    expect(button).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'layers', label: 'layers' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
