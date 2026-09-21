import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { PopoverComponent, type PopoverAnchor } from './popover.component';

/** Unter einem Knopf in der Kopfzeile. */
const BELOW: PopoverAnchor = { top: 68, end: 12 };
/** Über dem Plus-Knopf am unteren Rand. */
const ABOVE: PopoverAnchor = { bottom: 92, end: 24 };

@Component({
  imports: [PopoverComponent],
  template: `<app-popover
    [open]="open()"
    [anchor]="anchor()"
    [heading]="heading()"
    label="Auf der Karte"
    (closed)="closes = closes + 1"
  >
    <p>Inhalt</p>
  </app-popover>`,
})
class HostComponent {
  readonly open = signal(true);
  readonly anchor = signal<PopoverAnchor>(BELOW);
  readonly heading = signal('');
  closes = 0;
}

describe('PopoverComponent', () => {
  it('hängt die Karte an den Knopf und zeigt den Slot', async () => {
    const { container } = await render(HostComponent);

    const card = screen.getByRole('dialog', { name: 'Auf der Karte' });
    expect(card).toHaveStyle({ insetBlockStart: '68px', insetInlineEnd: '12px' });
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    await noViolations(container);
  });

  it('hängt die Karte über einen Knopf am unteren Rand', async () => {
    const { fixture, detectChanges } = await render(HostComponent);
    fixture.componentInstance.anchor.set(ABOVE);
    detectChanges();

    expect(screen.getByRole('dialog')).toHaveStyle({ insetBlockEnd: '92px', insetInlineEnd: '24px' });
  });

  it('setzt das Wort der Gruppe über die Zeilen', async () => {
    const { fixture, detectChanges } = await render(HostComponent);
    fixture.componentInstance.heading.set('Hintergrund');
    detectChanges();

    expect(screen.getByText('Hintergrund')).toHaveClass('popover__heading');
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
