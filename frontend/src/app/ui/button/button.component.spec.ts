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
    expect(container.querySelector('.spin')).not.toBeNull();
    expect(button.querySelector('span')).toHaveAttribute('hidden');
  });

  it('sperrt sich', async () => {
    await render(HostComponent, { componentProperties: { disabled: true } });

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
