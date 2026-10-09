import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Combination } from '../../core/api/models';
import { SAVED_COMBINATION } from '../../testing/map-doubles';
import { fromWire } from './factors';
import { MapOverlaysComponent, type Overlay } from './map-overlays.component';
import { MapView } from './map.view';
import { ViewportService } from '../../core/layout/viewport.service';

const SPECIES = [
  { value: 'boletus-edulis', name: 'Steinpilz', latin: 'Boletus edulis' },
  { value: 'cantharellus-cibarius', name: 'Pfifferling', latin: 'Cantharellus cibarius' },
];

function viewDouble(saved: readonly Combination[]) {
  const deleted: Combination[] = [];
  const picked: Combination[] = [];
  const chosenSpecies: string[] = [];
  const view = {
    state: { setSpecies: (slug: string) => chosenSpecies.push(slug), setLayer: () => undefined },
    combination: {
      factors: signal((SAVED_COMBINATION.factors ?? []).map(fromWire)),
      saved: signal(saved),
      pick: (combination: Combination) => picked.push(combination),
      delete: (combination: Combination) => {
        deleted.push(combination);
        return Promise.resolve();
      },
    },
    species: signal(SPECIES[0]),
    speciesChoices: signal(SPECIES),
    sources: signal(new Map()),
    layers: signal([]),
    layer: signal(null),
    weekKey: signal('2025-40'),
    layerName: () => '',
  };
  return { view, deleted, picked, chosenSpecies };
}

@Component({
  imports: [MapOverlaysComponent],
  template: `<app-map-overlays [open]="open()" (closed)="open.set(null)" />`,
})
class HostComponent {
  readonly open = signal<Overlay>(null);
}

async function overlays(saved: readonly Combination[] = [SAVED_COMBINATION], wide = false) {
  const double = viewDouble(saved);
  const { fixture, container } = await render(HostComponent, {
    providers: [
      { provide: MapView, useValue: double.view },
      { provide: ViewportService, useValue: { wide: signal(wide) } },
    ],
  });
  const show = async (open: Overlay): Promise<void> => {
    fixture.componentInstance.open.set(open);
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { ...double, show, container };
}

describe('MapOverlaysComponent', () => {
  it('opens the factor as a modal over the map also on the desktop (board `MapDesktopFactor`)', async () => {
    const { show, container } = await overlays([SAVED_COMBINATION], true);

    await show('factor');

    expect(container.querySelector('.overlay__panel')).not.toBeNull();
  });

  it('says that no combination is saved, and offers no apply then', async () => {
    const { show } = await overlays([]);

    await show('combinations');

    expect(screen.getByText('Noch keine Kombination gespeichert.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).not.toBeInTheDocument();
  });

  it('drops a cancelled species choice, so the next open shows the map species again', async () => {
    const { show, chosenSpecies } = await overlays();
    await show('species');

    await userEvent.click(screen.getByRole('checkbox', { name: /Pfifferling/ }));
    await show(null);
    await show('species');

    expect(screen.getByRole('checkbox', { name: /Steinpilz/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(chosenSpecies).toEqual(['boletus-edulis']);
  });

  it('drops a cancelled combination choice', async () => {
    const other: Combination = { ...SAVED_COMBINATION, id: 'k2', name: 'Fichte', factors: [] };
    const { show, picked } = await overlays([SAVED_COMBINATION, other]);
    await show('combinations');

    await userEvent.click(screen.getByRole('checkbox', { name: /^Fichte/ }));
    await show(null);
    await show('combinations');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(picked.map((combination) => combination.id)).toEqual(['k1']);
  });

  it('deletes the chosen saved combination after a confirmation', async () => {
    const { show, deleted } = await overlays();
    await show('combinations');
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /^Buchenwald/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(deleted).toEqual([]);
    expect(await screen.findByRole('heading', { name: 'Kombination löschen?' })).toBeInTheDocument();
    expect(document.querySelector('.confirm__meta')).toHaveTextContent('Buchenwald im Herbst');
    const confirm = screen.getAllByRole('button', { name: 'Löschen' }).at(-1);
    if (confirm === undefined) throw new Error('The confirmation is missing.');
    await userEvent.click(confirm);

    expect(deleted.map((combination) => combination.id)).toEqual(['k1']);
  });

  it('offers no delete without a chosen combination', async () => {
    const { show } = await overlays([{ ...SAVED_COMBINATION, factors: [] }]);
    await show('combinations');

    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
  });
});
