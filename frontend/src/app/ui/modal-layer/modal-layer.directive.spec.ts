import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ModalLayerDirective } from './modal-layer.directive';

@Component({
  imports: [ModalLayerDirective],
  template: `<div #layer="modalLayer" appModalLayer (dismissed)="dismissals = dismissals + 1">
    <h2 [id]="layer.labelId">Frage</h2>
  </div>`,
})
class HostComponent {
  dismissals = 0;
}

@Component({
  imports: [ModalLayerDirective],
  template: `<div appModalLayer></div>
    <div appModalLayer></div>`,
})
class TwoLayersComponent {}

describe('ModalLayerDirective', () => {
  it('macht aus dem Feld ein Blatt mit Titel', async () => {
    await render(HostComponent);

    const layer = screen.getByRole('dialog', { name: 'Frage' });
    expect(layer).toHaveAttribute('aria-modal', 'true');
    expect(layer).toHaveAttribute('tabindex', '-1');
  });

  it('setzt den Fokus und meldet Escape', async () => {
    const { fixture } = await render(HostComponent);
    expect(screen.getByRole('dialog')).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(fixture.componentInstance.dismissals).toBe(1);
  });

  it('gibt jedem Blatt eine eigene Kennung', async () => {
    await render(TwoLayersComponent);

    const all = screen.getAllByRole('dialog').map((node) => node.getAttribute('aria-labelledby'));

    expect(all).toHaveLength(2);
    expect(new Set(all).size).toBe(2);
  });
});
