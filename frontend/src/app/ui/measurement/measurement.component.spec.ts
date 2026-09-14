import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { MeasurementComponent, type Extent } from './measurement.component';

describe('MeasurementComponent', () => {
  it('nennt die Strecke als Wort und den Wert mit Einheit', async () => {
    const { container } = await render(MeasurementComponent, {
      inputs: { extent: 'width', spans: [{ from: 4, to: 20 }], unit: 'cm' },
    });

    expect(screen.getByText('Breite')).toBeInTheDocument();
    expect(screen.getByText('4 – 20')).toBeInTheDocument();
    expect(screen.getByText('cm')).toBeInTheDocument();
    await noViolations(container);
  });

  it.each<[Extent, string]>([
    ['width', 'Breite'],
    ['height', 'Höhe'],
    ['length', 'Länge'],
    ['thickness', 'Dicke'],
  ])('übersetzt %s als %s', async (extent, wort) => {
    await render(MeasurementComponent, { inputs: { extent, spans: [{ from: 1, to: null }], unit: 'cm' } });

    expect(screen.getByText(wort)).toBeInTheDocument();
  });

  it('schreibt einen einzelnen Wert ohne Strich', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'thickness', spans: [{ from: 0.3, to: null }], unit: 'mm' },
    });

    expect(screen.getByText('0,3')).toBeInTheDocument();
  });

  it('schreibt eine Spanne aus zwei gleichen Werten als einen', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'height', spans: [{ from: 5, to: 5 }], unit: 'cm' },
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('setzt Kommas statt Punkte', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'length', spans: [{ from: 12.4, to: 19.2 }], unit: 'µm' },
    });

    expect(screen.getByText('12,4 – 19,2')).toBeInTheDocument();
  });

  it('trägt die seltene Ausnahme nach oben als Unterzeile', async () => {
    // Die übliche Spanne endet bei 20, die Ausnahme reicht seltener an 25 heran.
    await render(MeasurementComponent, {
      inputs: {
        extent: 'width',
        spans: [
          { from: 4, to: 20 },
          { from: null, to: 25 },
        ],
        unit: 'cm',
      },
    });

    expect(screen.getByText('selten bis 25 cm')).toBeInTheDocument();
  });

  it('trägt die seltene Ausnahme nach unten als Unterzeile', async () => {
    await render(MeasurementComponent, {
      inputs: {
        extent: 'height',
        spans: [
          { from: 5, to: 15 },
          { from: 2, to: null },
        ],
        unit: 'cm',
      },
    });

    expect(screen.getByText('selten ab 2 cm')).toBeInTheDocument();
  });

  it('bleibt ohne seltene Ausnahme ohne Unterzeile', async () => {
    const { container } = await render(MeasurementComponent, {
      inputs: { extent: 'width', spans: [{ from: 4, to: 20 }], unit: 'cm' },
    });

    expect(container.querySelector('.measure__rare')).toBeNull();
  });

  it('zeigt die Trennlinie zwischen zwei Zeilen, nicht nach der letzten', async () => {
    const { container } = await render(
      `<app-measurement [extent]="'width'" [spans]="spans" unit="cm" />
       <app-measurement [extent]="'height'" [spans]="spans" unit="cm" />`,
      { imports: [MeasurementComponent], componentProperties: { spans: [{ from: 1, to: 2 }] } },
    );

    // Die Trennlinie hängt an :host(:last-child) in der SCSS. jsdom löst
    // keine CSS-Variable auf, darum prüft der Test die Stellung im Baum.
    const rows = container.querySelectorAll('app-measurement');
    expect(rows[0].matches(':last-child')).toBe(false);
    expect(rows[1].matches(':last-child')).toBe(true);
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(MeasurementComponent, {
      providers: [EMPTY_CATALOG],
      inputs: {
        extent: 'width',
        spans: [
          { from: 4, to: 20 },
          { from: null, to: 25 },
        ],
        unit: 'cm',
      },
    });

    noGermanText(container);
  });
});
