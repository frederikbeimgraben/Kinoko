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
    expect(button).toHaveClass('tap');
    expect(button).toHaveAttribute('data-press', 'scale');
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

  it('kennt eine primäre Variante', async () => {
    const { container } = await render(IconButtonComponent, {
      inputs: { icon: 'check', label: 'Annehmen', variant: 'primary' },
    });

    expect(container.querySelector('.icon-button--primary')).not.toBeNull();
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
