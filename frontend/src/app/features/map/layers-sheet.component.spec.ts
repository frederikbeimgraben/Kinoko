import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { LayersBodyComponent } from './layers-body.component';
import { LayersSheetComponent } from './layers-sheet.component';
import { MapStore } from './map.store';
import { MapView } from './map.view';

const onLayer = signal(false);
const VIEW = { provide: MapView, useValue: { onLayer } };

describe('LayersSheetComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    onLayer.set(false);
  });

  it('shows the layers body in a sheet with a title', async () => {
    const { container } = await render(LayersSheetComponent, { providers: [VIEW] });

    expect(screen.getByRole('heading', { name: 'Ebenen' })).toBeInTheDocument();
    expect(container.querySelector('app-layers-body')).not.toBeNull();
    await noViolations(container);
  });

  it('closes on Escape', async () => {
    const { fixture } = await render(LayersSheetComponent, { providers: [VIEW] });
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    await userEvent.keyboard('{Escape}');

    expect(closed).toBe(1);
  });
});

describe('LayersBodyComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    onLayer.set(false);
  });

  it('shows the ground, the style, the opacity and the switches', async () => {
    await render(LayersBodyComponent, { providers: [VIEW] });

    expect(screen.getByText('Karte')).toBeInTheDocument();
    expect(screen.getByText('Luftbild')).toBeInTheDocument();
    expect(screen.getByText('© GeoBasis-DE / BKG')).toBeInTheDocument();
    expect(screen.getByText('Gelände')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Hell' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Funde' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('switch', { name: 'Vorhersage darunter' })).not.toBeInTheDocument();
  });

  it('takes a style that exists and ignores a ground without a source', async () => {
    await render(LayersBodyComponent, { providers: [VIEW] });
    const store = TestBed.inject(MapStore);

    await userEvent.click(screen.getByRole('tab', { name: 'Dunkel' }));
    expect(store.background()).toBe('dark');

    await userEvent.click(screen.getByText('Gelände'));
    expect(store.background()).toBe('dark');
  });

  it('writes the opacity as a share', async () => {
    await render(LayersBodyComponent, { providers: [VIEW] });

    fireEvent.input(screen.getAllByRole('slider')[0], { target: { value: '40' } });

    expect(TestBed.inject(MapStore).opacity()).toBeCloseTo(0.4);
  });

  it('switches the markers, the zones and the shared finds', async () => {
    await render(LayersBodyComponent, { providers: [VIEW] });
    const store = TestBed.inject(MapStore);

    await userEvent.click(screen.getByRole('switch', { name: 'Marker' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Zonen' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Funde' }));

    expect([store.showMarkers(), store.showZones(), store.showSharedFinds()]).toEqual([false, false, false]);
  });

  it('offers the forecast below only in the layer view', async () => {
    onLayer.set(true);
    await render(LayersBodyComponent, { providers: [VIEW] });

    await userEvent.click(screen.getByRole('switch', { name: 'Vorhersage darunter' }));

    expect(TestBed.inject(MapStore).forecastBelow()).toBe(true);
  });
});
