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

  it('trägt Tippfläche und Druckzustand', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: 'frederik', label: 'Konto' },
    });

    const button = container.querySelector('button');
    expect(button).toHaveClass('tap');
    expect(button).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: 'frederik', label: 'account' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
