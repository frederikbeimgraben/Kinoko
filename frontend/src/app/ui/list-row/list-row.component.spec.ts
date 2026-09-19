import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { ListRowComponent } from './list-row.component';

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null | undefined): CSSStyleDeclaration {
  if (element === null || element === undefined) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

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

  it('hält die Unterzeile in einer Zeile und kürzt sie mit Auslassung', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Wikipedia', subline: 'de.wikipedia.org/wiki/Gemeiner_Steinpilz' },
    });

    const style = styleOf(container.querySelector('.row__sub'));
    expect(style.whiteSpace).toBe('nowrap');
    expect(style.textOverflow).toBe('ellipsis');
    expect(style.overflow).toBe('hidden');
  });

  it('setzt den Gruppentitel des Filters auf die Zeilenhöhe des Boards', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Speisewert', kind: 'filter' },
    });

    expect(styleOf(container.querySelector('.row__title--filter')).lineHeight).toBe('normal');
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

  it('trägt den Titel in der Primärfarbe, wenn eine Zeile ohne Chevron führt', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Steinpilz', accent: true, clickable: true },
    });

    expect(container.querySelector('.row__title--accent')).not.toBeNull();
  });

  it('lässt den Wert die Primärfarbe tragen, wenn er einen Wert nennt', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Steinpilz', value: '3', accent: true },
    });

    expect(container.querySelector('.row__title--accent')).toBeNull();
    expect(container.querySelector('.row__value--accent')).not.toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Row', subline: 'Sub', value: '1' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
