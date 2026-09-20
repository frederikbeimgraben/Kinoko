import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { AvatarButtonComponent } from './avatar-button.component';

describe('AvatarButtonComponent', () => {
  it('zeigt die Initiale und meldet den Klick', async () => {
    const { container, fixture } = await render(AvatarButtonComponent, {
      inputs: { name: 'frederik', label: 'Konto' },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    expect(screen.getByText('F')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Konto' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('zeigt bei offener Sitzung ein Skelett statt einer Initiale', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: null, label: 'Konto' },
    });

    expect(container.querySelector('app-skeleton')).toBeInTheDocument();
    expect(container.querySelector('span[aria-hidden]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Konto' })).toHaveTextContent('');
    await noViolations(container);
  });

  it('bleibt ohne Namen leer', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: '   ', label: 'Konto' },
    });

    expect(container.querySelector('span[aria-hidden]')?.textContent).toBe('');
  });

  it('setzt einen Kreis am Berührungspunkt statt der Verkleinerung', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: 'frederik', label: 'Konto' },
    });

    const button = container.querySelector<HTMLElement>('button');
    if (button === null) throw new Error('kein Knopf');
    expect(button).toHaveClass('tap');
    expect(button).not.toHaveAttribute('data-press');

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
      toJSON: () => undefined,
    });
    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 20 }));

    expect(button.querySelector('.ripple')).not.toBeNull();
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: 'frederik', label: 'account' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
