import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { RowGroupComponent } from '../row-group/row-group.component';
import { ListRowComponent } from './list-row.component';

/** Returns the computed styles of an element that must exist. */
function styleOf(element: Element | null | undefined): CSSStyleDeclaration {
  if (element === null || element === undefined) throw new Error('The element is not in the tree.');
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

@Component({
  imports: [ListRowComponent, RowGroupComponent],
  template: `
    <app-row-group>
      <app-list-row title="Pfifferling" />
      <app-list-row title="Steinpilz" />
    </app-row-group>
  `,
})
class GroupedHostComponent {}

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

  it('makes the label bold only for a head row or a row with a sub-line', async () => {
    const { container, rerender } = await render(ListRowComponent, { inputs: { title: 'Speisewert' } });
    const strong = (): boolean => !!container.querySelector('.row__title--strong');

    expect(strong()).toBe(false);
    await rerender({ inputs: { title: 'Speisewert', variant: 'head' } });
    expect(strong()).toBe(true);
    await rerender({ inputs: { title: 'Speisewert', variant: 'plain', subline: 'essbar' } });
    expect(strong()).toBe(true);
  });

  it('uses the kit geometry: padding 8 16 and gap 12', async () => {
    const { container } = await render(ListRowComponent, { inputs: { title: 'Speisewert' } });

    const field = styleOf(container.querySelector('.row__field'));
    expect(field.padding).toBe('8px var(--list-row-inline, 16px)');
    expect(field.gap).toBe('var(--list-row-gap, 12px)');
  });

  it('shows the value with its unit, a plain text, a badge and a swatch', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: {
        title: 'Hut',
        value: '8',
        unit: 'cm',
        plain: 'braun',
        badge: 'essbar',
        badgeKind: 'ok',
        swatch: 'rgb(122, 82, 48)',
      },
    });

    expect(container.querySelector('.row__unit')).toHaveTextContent('cm');
    expect(styleOf(container.querySelector('.row__value')).fontVariantNumeric).toBe('tabular-nums');
    expect(screen.getByText('braun')).toHaveClass('row__plain');
    expect(container.querySelector('app-level-pill')).toHaveTextContent('essbar');
    expect(styleOf(container.querySelector('.row__swatch')).backgroundColor).toBe('rgb(122, 82, 48)');
  });

  it('gives a thumbed row the small start padding and a wrapped row more lines', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Lamellen', subline: 'eine lange Erklärung', thumbed: true, wrap: true },
    });

    expect(container.querySelector('.row')).toHaveClass('row--thumbed', 'row--wrap');
    expect(styleOf(container.querySelector('.row__sub')).whiteSpace).toBe('normal');
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

  it('lässt den Wert die Primärfarbe tragen, wenn die Zeile einen Chevron trägt', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Speisewert', value: 'essbar', accent: true, chevron: true },
    });

    expect(container.querySelector('.row__title--accent')).toBeNull();
    expect(container.querySelector('.row__value--accent')).not.toBeNull();
  });

  it('trägt für sich den kleinen Radius des Kits', async () => {
    const { container } = await render(ListRowComponent, { inputs: { title: 'Speisewert' } });

    expect(styleOf(container.querySelector('.row')).borderRadius).toBe('var(--r-row)');
  });

  it('trägt in einer Gruppe die Radien des Kits, aussen 20, innen 4', async () => {
    const { container } = await render(GroupedHostComponent);

    const rows = container.querySelectorAll('app-list-row');
    const firstRow = styleOf(rows[0].querySelector('.row'));
    const lastRow = styleOf(rows[1].querySelector('.row'));

    expect(firstRow.borderRadius).toBe('var(--r-item) var(--r-item) var(--r-row) var(--r-row)');
    expect(lastRow.borderRadius).toBe('var(--r-row) var(--r-row) var(--r-item) var(--r-item)');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: { title: 'Row', subline: 'Sub', value: '1' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
