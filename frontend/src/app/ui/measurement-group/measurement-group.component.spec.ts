import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { MeasurementGroupComponent, type MeasurementRow } from './measurement-group.component';

const STIEL: readonly MeasurementRow[] = [
  { extent: 'height', spans: [{ from: 5, to: 15 }], unit: 'cm' },
  { extent: 'thickness', spans: [{ from: 2, to: 6 }], unit: 'cm' },
];

describe('MeasurementGroupComponent', () => {
  it('zeigt den Körperteil als Überschrift und jede Strecke als Zeile', async () => {
    const { container } = await render(MeasurementGroupComponent, {
      inputs: { part: 'Stiel', measurements: STIEL },
    });

    expect(screen.getByText('Stiel')).toBeInTheDocument();
    expect(container.querySelectorAll('app-measurement')).toHaveLength(2);
    expect(screen.getByText('Höhe')).toBeInTheDocument();
    expect(screen.getByText('Dicke')).toBeInTheDocument();
    await noViolations(container);
  });

  it('hält zwei Maße desselben Teils untereinander, nie neben einem anderen Teil', async () => {
    const { container } = await render(MeasurementGroupComponent, {
      inputs: { part: 'Stiel', measurements: STIEL },
    });

    const rows = container.querySelectorAll('app-measurement');
    expect(rows).toHaveLength(2);
    // Beide Zeilen sind Kinder derselben Karte, keine eigene Unterkarte je Maß.
    expect(rows[0].parentElement).toBe(rows[1].parentElement);
  });

  it('zeigt eine einzelne Strecke ohne zweite Zeile', async () => {
    const { container } = await render(MeasurementGroupComponent, {
      inputs: { part: 'Hut', measurements: [{ extent: 'width', spans: [{ from: 4, to: 20 }], unit: 'cm' }] },
    });

    expect(container.querySelectorAll('app-measurement')).toHaveLength(1);
  });

  it('bleibt ohne Strecke ohne doppelte Trennlinie unter der Überschrift', async () => {
    const { container } = await render(MeasurementGroupComponent, {
      inputs: { part: 'Sporen', measurements: [] },
    });

    expect(container.querySelectorAll('app-measurement')).toHaveLength(0);
    expect(container.querySelector('.group__part')).toHaveClass('group__part--bare');
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(MeasurementGroupComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { part: 'Stem', measurements: STIEL },
    });

    noGermanText(container);
  });
});
