import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { PopoverComponent, type PopoverAnchor } from './popover.component';

const ANCHOR: PopoverAnchor = { top: 68, end: 12 };

@Component({
  imports: [PopoverComponent],
  template: `<app-popover
    [open]="open()"
    [anchor]="anchor"
    label="Auf der Karte"
    (closed)="closes = closes + 1"
  >
    <p>Inhalt</p>
  </app-popover>`,
})
class HostComponent {
  readonly open = signal(true);
  closes = 0;
  readonly anchor = ANCHOR;
}

describe('PopoverComponent', () => {
  it('hängt die Karte an den Knopf und zeigt den Slot', async () => {
    const { container } = await render(HostComponent);

    const card = screen.getByRole('dialog', { name: 'Auf der Karte' });
    expect(card).toHaveStyle({ insetBlockStart: '68px', insetInlineEnd: '12px' });
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt zu, solange niemand sie öffnet', async () => {
    const { fixture, detectChanges } = await render(HostComponent);
    fixture.componentInstance.open.set(false);
    detectChanges();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('meldet das Schließen über Escape', async () => {
    const { fixture } = await render(HostComponent);

    await userEvent.keyboard('{Escape}');

    expect(fixture.componentInstance.closes).toBe(1);
  });
});
