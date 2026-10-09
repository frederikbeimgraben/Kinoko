import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ButtonComponent, type ButtonKind } from './button.component';

@Component({
  imports: [ButtonComponent],
  template: `<app-push-button [kind]="kind" [wide]="wide" [busy]="busy" [disabled]="disabled">{{
    label
  }}</app-push-button>`,
})
class HostComponent {
  kind: ButtonKind = 'primary';
  wide = false;
  busy = false;
  disabled = false;
  label = 'Speichern';
}

describe('ButtonComponent', () => {
  it('zeigt seine Beschriftung', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    await noViolations(container);
  });

  it.each(['primary', 'tonal', 'outline', 'text', 'danger', 'textdanger'] as const)(
    'kennt den Auftritt %s',
    async (kind) => {
      const { container } = await render(HostComponent, { componentProperties: { kind } });

      expect(container.querySelector(`.btn.${kind}`)).not.toBeNull();
    },
  );

  it('trägt die volle Breite, wenn wide gesetzt ist', async () => {
    const { container } = await render(HostComponent, { componentProperties: { wide: true } });

    expect(container.querySelector('.btn.wide')).not.toBeNull();
  });

  it('zeigt einen Kreisel statt der Beschriftung, solange er läuft', async () => {
    const { container } = await render(HostComponent, { componentProperties: { busy: true } });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.spin')).not.toBeNull();
    expect(button.querySelector('.face > span')).toHaveAttribute('hidden');
  });

  it('shows the press of a wide text button around its label, not over the full width', async () => {
    const { container } = await render(HostComponent, {
      componentProperties: { kind: 'textdanger', wide: true },
    });
    const button = screen.getByRole('button');
    const face = container.querySelector<HTMLElement>('.face');

    button.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1 }));

    expect(button).toHaveClass('shapeless');
    expect(face?.querySelector('.ripple')).not.toBeNull();
  });

  it('shows the press over the full fill of a wide filled button', async () => {
    const { container } = await render(HostComponent, {
      componentProperties: { kind: 'danger', wide: true },
    });
    const button = screen.getByRole('button');

    button.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1 }));

    expect(button).not.toHaveClass('shapeless');
    expect(container.querySelector('.face .ripple')).toBeNull();
    expect(button.querySelector(':scope > .ripple-frame .ripple')).not.toBeNull();
  });

  it('sperrt sich', async () => {
    await render(HostComponent, { componentProperties: { disabled: true } });

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
