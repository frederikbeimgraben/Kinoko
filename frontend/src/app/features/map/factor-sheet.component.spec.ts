import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { readLayers, type Layer, type Histogram } from '../../core/tiles/layers';
import { FactorSheetComponent, stepSize } from './factor-sheet.component';
import type { Factor } from './factors';

const RAIN: Layer = readLayers({
  layers: {
    regen_4w: {
      label: 'Niederschlag',
      note: 'Summe KW 37 bis 40',
      unit: 'mm',
      static: false,
      low: 0,
      high: 100,
      tiles: 'x',
    },
  },
}).layers[0];

const DISTRIBUTION: Histogram = { klassen: [0, 50, 100], anteile: [0.6, 0.4] };

const FACTOR: Factor = { source: 'regen_4w', condition: 'above', low: 80, high: 0, active: true };

function sheet(factor: Factor = FACTOR) {
  return render(FactorSheetComponent, {
    inputs: { factor, layer: RAIN, histogram: DISTRIBUTION },
  });
}

describe('FactorSheetComponent', () => {
  it('zeigt Quelle, Zeitbezug, Verteilung und Bedingung', async () => {
    const { container } = await sheet();

    expect(screen.getByText('Niederschlag')).toBeInTheDocument();
    expect(screen.getByText('Summe KW 37 bis 40')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Verteilung über Deutschland/ })).toBeInTheDocument();
    expect(screen.getAllByText('≥ 80 mm').length).toBeGreaterThan(0);
    await noViolations(container);
  });

  it('nennt die Grenzen der Skala und die Bedingung dazwischen', async () => {
    await sheet();

    expect(screen.getByText('0 mm')).toBeInTheDocument();
    expect(screen.getByText('100 mm')).toBeInTheDocument();
    expect(screen.getByText('80 mm')).toBeInTheDocument();
  });

  it('zeigt bei „über“ nur den unteren Griff', async () => {
    await sheet();

    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Obere Grenze' })).not.toBeInTheDocument();
  });

  it('wechselt die Form der Bedingung und behält die Spanne', async () => {
    const { fixture } = await sheet();
    const applied: Factor[] = [];
    fixture.componentInstance.apply.subscribe((factor) => applied.push(factor));

    await userEvent.click(screen.getByRole('tab', { name: 'zwischen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(applied[0]).toEqual({ ...FACTOR, condition: 'between', low: 80, high: 100 });
  });

  it('zieht die Griffe und lässt sie nicht aneinander vorbei', async () => {
    const { fixture } = await sheet({ ...FACTOR, condition: 'between', low: 20, high: 60 });
    const applied: Factor[] = [];
    fixture.componentInstance.apply.subscribe((factor) => applied.push(factor));

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '90' } });
    fireEvent.input(screen.getByRole('slider', { name: 'Obere Grenze' }), { target: { value: '10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(applied[0].low).toBe(60);
    expect(applied[0].high).toBe(60);
  });

  it('meldet das Entfernen', async () => {
    const { fixture } = await sheet();
    let removed = 0;
    fixture.componentInstance.removed.subscribe(() => (removed += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Faktor entfernen' }));

    expect(removed).toBe(1);
  });

  it('kommt ohne Verteilung aus', async () => {
    await render(FactorSheetComponent, { inputs: { factor: FACTOR, layer: RAIN, histogram: null } });

    expect(screen.queryByRole('img', { name: /Verteilung/ })).not.toBeInTheDocument();
  });

  it('wählt die Schrittweite nach der Breite der Skala', () => {
    expect(stepSize({ ...RAIN, low: 0, high: 100 })).toBe(1);
    expect(stepSize({ ...RAIN, low: 0, high: 20 })).toBe(0.1);
    expect(stepSize({ ...RAIN, low: 0, high: 1 })).toBe(0.01);
  });
});
