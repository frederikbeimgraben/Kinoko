import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { KeyValueRowComponent } from './key-value-row.component';
import { KeyValueTableComponent } from './key-value-table.component';

@Component({
  imports: [KeyValueTableComponent, KeyValueRowComponent],
  template: `
    <app-key-value-table>
      <app-key-value-row key="Hut" value="6 bis 25 cm" />
      <app-key-value-row key="Speisewert"><span>Speisepilz</span></app-key-value-row>
    </app-key-value-table>
  `,
})
class HostComponent {}

@Component({
  imports: [KeyValueTableComponent, KeyValueRowComponent],
  template: `
    <app-key-value-table>
      <app-key-value-row key="" [values]="['Steinpilz', 'Gallenröhrling']" />
      <app-key-value-row key="Speisewert" [values]="['essbar', 'ungenießbar']" />
    </app-key-value-table>
  `,
})
class CompareHostComponent {}

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('KeyValueTableComponent', () => {
  it('zeigt Schlüssel und Wert je Zeile', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByText('Hut')).toBeInTheDocument();
    expect(screen.getByText('6 bis 25 cm')).toBeInTheDocument();
    await noViolations(container);
  });

  it('nimmt einen reichen Wert als Inhalt an', async () => {
    await render(HostComponent);

    expect(screen.getByText('Speisepilz')).toBeInTheDocument();
  });

  it('trägt das Raster an der Tabelle, nicht an der Zeile', async () => {
    // Eine Zeile mit eigenen Spalten weicht vom Nachbarn ab, sobald ihr
    // Inhalt breiter ist. Das gemeinsame Raster der Tabelle hält 104 px ein.
    const { container } = await render(HostComponent);

    const table = styleOf(container.querySelector('app-key-value-table'));
    expect(table.getPropertyValue('--key-value-table-label')).toBe('104px');
    expect(table.gridTemplateColumns).toContain('minmax(0, 1fr)');
    expect(styleOf(container.querySelector('app-key-value-row')).display).toBe('contents');
    // Kein Rasterabstand: eine Lücke zwischen den Zellen schnitte Zebra und
    // Trennlinie in zwei Hälften. Der Abstand steckt im Polster.
    expect(table.columnGap).not.toBe('12px');
  });

  it('stellt im Vergleich mehrere Wertspalten nebeneinander, ohne eine abweichende zu tönen', async () => {
    const { container } = await render(CompareHostComponent);

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    const values = container.querySelectorAll('.kv__value');
    expect(values).toHaveLength(4);
    // Beide Spalten einer Zeile tragen dieselbe Fläche, auch wenn ihr Wert
    // sich unterscheidet. Ein Zebra bleibt im Vergleich ganz aus.
    expect(styleOf(values[0]).backgroundColor).toBe(styleOf(values[1]).backgroundColor);
    expect(styleOf(values[2]).backgroundColor).toBe(styleOf(values[3]).backgroundColor);
    expect(styleOf(values[0]).backgroundColor).toBe(styleOf(values[2]).backgroundColor);
  });
});
