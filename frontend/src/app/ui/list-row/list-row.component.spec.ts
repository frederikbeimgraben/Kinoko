import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { ListRowComponent } from './list-row.component';

@Component({
  imports: [ListRowComponent],
  template: `
    <app-list-row
      title="Frederik"
      subline="frederik@example.net"
      value="Admin"
      [chevron]="true"
      [clickable]="true"
    >
      <span lead>F</span>
      <span trail>●</span>
      <button action type="button">edit</button>
    </app-list-row>
  `,
})
class SlottedHostComponent {}

describe('ListRowComponent', () => {
  it('rendert mit dem Titel allein', async () => {
    const { container } = await render(ListRowComponent, { inputs: { title: 'Pfifferling' } });

    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt Unterzeile, Wert und Chevron', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Speisewert', subline: 'essbar', value: '77', chevron: true },
    });

    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
    expect(container.querySelector('.row__chevron')).not.toBeNull();
  });

  it('wird zur Schaltfläche, wenn die Zeile anklickbar ist', async () => {
    const { fixture } = await render(ListRowComponent, {
      inputs: { title: 'Steinpilz', clickable: true },
    });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));
    const button = screen.getByRole('button', { name: 'Steinpilz' });

    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');

    expect(calls).toBe(2);
    expect(button).toHaveClass('tap');
    expect(button).toHaveAttribute('data-press', 'tint');
  });

  it('bleibt ohne Schaltfläche, solange die Zeile nichts öffnet', async () => {
    await render(ListRowComponent, { inputs: { title: 'Steinpilz' } });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('meldet eine Wahl über aria-pressed', async () => {
    await render(ListRowComponent, {
      inputs: { title: 'Steinpilz', clickable: true, selected: true },
    });

    expect(screen.getByRole('button', { name: 'Steinpilz' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('nimmt Vorne, Hinten und Aktion als eigenen Inhalt an', async () => {
    await render(SlottedHostComponent);

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('●')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'edit' })).toBeInTheDocument();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Row', subline: 'Sub', value: '1' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
