import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { IconButtonComponent } from './icon-button.component';

describe('IconButtonComponent', () => {
  it('trägt das Icon und meldet den Klick', async () => {
    const { container, fixture } = await render(IconButtonComponent, {
      inputs: { icon: 'check', label: 'Annehmen' },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    const button = screen.getByRole('button', { name: 'Annehmen' });
    await userEvent.click(button);

    expect(calls).toBe(1);
    expect(button).toHaveClass('icon-button--tonal');
    await noViolations(container);
  });

  it('zeigt das Ablehnen-Icon', async () => {
    const { container } = await render(IconButtonComponent, {
      inputs: { icon: 'close', label: 'Ablehnen' },
    });

    expect(container.querySelector('path[d^="M6 6l12 12"]')).not.toBeNull();
  });

  it('zeigt das Löschen-Icon', async () => {
    const { container } = await render(IconButtonComponent, {
      inputs: { icon: 'delete', label: 'Löschen' },
    });

    expect(container.querySelector('path[d^="M4 7h16"]')).not.toBeNull();
  });

  it('zeigt den gefüllten Pfeil für die Wochennavigation', async () => {
    const { container } = await render(IconButtonComponent, {
      inputs: { icon: 'prev', label: 'Vorige Woche' },
    });

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });

  it.each(['tonal', 'plain', 'fab', 'fabl', 'accept', 'reject', 'over'] as const)(
    'kennt den Auftritt %s',
    async (kind) => {
      const { container } = await render(IconButtonComponent, {
        inputs: { icon: 'check', label: 'Annehmen', kind },
      });

      expect(container.querySelector(`.icon-button--${kind}`)).not.toBeNull();
    },
  );

  it('vergrößert das Icon bei accept und reject', async () => {
    const { container } = await render(IconButtonComponent, {
      inputs: { icon: 'check', label: 'Annehmen', kind: 'accept' },
    });

    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
  });

  it('sperrt sich und nimmt keinen Klick an', async () => {
    const { fixture } = await render(IconButtonComponent, {
      inputs: { icon: 'check', label: 'Annehmen', disabled: true },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    const button = screen.getByRole('button', { name: 'Annehmen' });
    expect(button).toBeDisabled();
    await userEvent.click(button);

    expect(calls).toBe(0);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(IconButtonComponent, {
      inputs: { icon: 'delete', label: 'Delete' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
