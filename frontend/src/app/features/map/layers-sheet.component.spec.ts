import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { LayersSheetComponent } from './layers-sheet.component';

function sheet(inputs: Record<string, unknown> = {}) {
  return render(LayersSheetComponent, {
    inputs: {
      background: 'map',
      opacity: 0.8,
      markerCount: 5,
      zoneCount: 2,
      sharedFindCount: 12,
      ...inputs,
    },
  });
}

describe('LayersSheetComponent', () => {
  it('zeigt Hintergrund, die eigenen Objekte und die Deckkraft', async () => {
    const { container } = await sheet();

    expect(screen.getByRole('dialog', { name: 'Ebenen' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Karte' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Topo' })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toHaveValue('80');
    await noViolations(container);
  });

  it('meldet einen Hintergrund, den es gibt, und schluckt den Rest', async () => {
    const { fixture } = await sheet();
    const chosen: string[] = [];
    fixture.componentInstance.backgroundChange.subscribe((value) => chosen.push(value));

    await userEvent.click(screen.getByRole('tab', { name: 'Hell' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Topo' }));

    expect(chosen).toEqual(['light']);
  });

  it('meldet die Deckkraft als Anteil', async () => {
    const { fixture } = await sheet();
    const values: number[] = [];
    fixture.componentInstance.opacityChange.subscribe((value) => values.push(value));

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '40' } });

    expect(values).toEqual([0.4]);
  });

  it('zeigt die Vorhersage darunter nicht ohne die Darstellung Ebene', async () => {
    await sheet();

    expect(screen.queryByText('Vorhersage darunter')).not.toBeInTheDocument();
  });

  it('bietet die Vorhersage darunter in der Darstellung Ebene', async () => {
    const { fixture } = await sheet({ showsLayer: true });
    let below: boolean | null = null;
    fixture.componentInstance.forecastBelowChange.subscribe((value) => (below = value));

    await userEvent.click(screen.getByText('Vorhersage darunter'));

    expect(below).toBe(true);
  });

  it('schaltet Marker, Zonen und geteilte Funde', async () => {
    const { fixture } = await sheet();
    const changes: string[] = [];
    fixture.componentInstance.showMarkersChange.subscribe(() => changes.push('marker'));
    fixture.componentInstance.showZonesChange.subscribe(() => changes.push('zone'));
    fixture.componentInstance.showSharedFindsChange.subscribe(() => changes.push('shared'));

    await userEvent.click(screen.getByText('Meine Marker'));
    await userEvent.click(screen.getByText('Zonen'));
    await userEvent.click(screen.getByText('Geteilte Funde'));

    expect(changes).toEqual(['marker', 'zone', 'shared']);
  });

  it('schließt über Escape', async () => {
    const { fixture } = await sheet();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    await userEvent.keyboard('{Escape}');

    expect(closed).toBe(1);
  });
});
