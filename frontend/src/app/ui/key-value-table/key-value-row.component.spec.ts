import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { KeyValueRowComponent } from './key-value-row.component';

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('KeyValueRowComponent', () => {
  it('rendert mit dem Schlüssel allein', async () => {
    const { container } = await render(KeyValueRowComponent, { inputs: { key: 'Hut' } });

    expect(screen.getByText('Hut')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt ein Wort zum Schlüssel, das den Wert benennt', async () => {
    await render(KeyValueRowComponent, {
      inputs: { key: 'Hut', hint: 'hell bis dunkelbraun' },
    });

    expect(screen.getByText('hell bis dunkelbraun')).toBeInTheDocument();
  });

  it('führt über einen Verweis weiter, wenn der Schlüssel eine Route trägt', async () => {
    await render(KeyValueRowComponent, {
      inputs: { key: 'Gallenröhrling', value: 'ungenießbar', route: '/arten/gallenroehrling' },
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('link', { name: 'Gallenröhrling' })).toHaveAttribute(
      'href',
      '/arten/gallenroehrling',
    );
  });

  it('lässt einen langen Schlüssel umbrechen, statt in den Wert zu laufen', async () => {
    const { container } = await render(KeyValueRowComponent, {
      inputs: { key: 'Ölbaumtrichterling XXXXXX', value: 'Giftig.' },
    });

    expect(styleOf(container.querySelector('.kv__key')).overflowWrap).toBe('anywhere');
  });

  it('setzt den Wert an die rechte Kante', async () => {
    const { container } = await render(KeyValueRowComponent, {
      inputs: { key: 'Hut', value: '6 bis 25 cm' },
    });

    const value = styleOf(container.querySelector('.kv__value'));
    expect(value.alignItems).toBe('flex-end');
    expect(value.textAlign).toBe('end');
  });

  it('lässt Fließtext links beginnen', async () => {
    const { container } = await render(KeyValueRowComponent, {
      inputs: { key: 'Hut', value: 'Vier Zeilen Prosa.', flow: true },
    });

    const value = styleOf(container.querySelector('.kv__value'));
    expect(value.alignItems).toBe('flex-start');
    expect(value.textAlign).toBe('start');
  });

  it('stellt mehrere Werte als eigene Spalten dar', async () => {
    const { container } = await render(KeyValueRowComponent, {
      inputs: { key: 'Speisewert', values: ['essbar', 'ungenießbar'] },
    });

    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(screen.getByText('ungenießbar')).toBeInTheDocument();
    expect(container.querySelectorAll('.kv__value')).toHaveLength(2);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(KeyValueRowComponent, {
      inputs: { key: 'Key', value: 'Value', hint: 'Hint' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
