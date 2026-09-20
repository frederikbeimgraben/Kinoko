import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FloatingButtonComponent } from './floating-button.component';

describe('FloatingButtonComponent', () => {
  it('trägt seine Beschriftung sichtbar und meldet den Klick', async () => {
    const { container, fixture } = await render(FloatingButtonComponent, {
      inputs: { icon: 'plus', label: 'Eintragen' },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Eintragen' }));

    expect(screen.getByText('Eintragen')).toBeInTheDocument();
    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('zeigt nur das Icon, ohne sichtbares Wort', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'layers', label: 'Ebenen', iconOnly: true },
    });

    expect(container.querySelector('.floating--icon-only')).not.toBeNull();
    expect(screen.queryByText('Ebenen')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ebenen' })).toBeInTheDocument();
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

  it('dreht nur das Icon, für die Nadel des Kompasses', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'compass', label: 'Norden', iconOnly: true, rotation: 45 },
    });

    expect(container.querySelector('.floating__icon')).toHaveStyle({ rotate: '45deg' });
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'plus', label: 'add' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
