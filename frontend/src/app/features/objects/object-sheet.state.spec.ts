import { TestBed } from '@angular/core/testing';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { MapState } from '../map/map.state';
import { ObjectSheetState } from './object-sheet.state';

function build(): { state: ObjectSheetState; map: MapState; stack: OverlayStackService } {
  return {
    state: TestBed.inject(ObjectSheetState),
    map: TestBed.inject(MapState),
    stack: TestBed.inject(OverlayStackService),
  };
}

describe('ObjectSheetState', () => {
  it('legt beim Öffnen einen Verlaufseintrag an', () => {
    const { state, map, stack } = build();
    const open = vi.spyOn(stack, 'open');

    state.show('marker', 'marker-eins');

    expect(map.object()).toEqual({ kind: 'marker', id: 'marker-eins' });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('legt beim Wechsel auf ein anderes Objekt keinen zweiten Eintrag an', () => {
    const { state, stack } = build();
    const open = vi.spyOn(stack, 'open');
    state.show('marker', 'marker-eins');

    state.show('zone', 'zone-eins');

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('geht beim Schließen einen Schritt zurück', () => {
    const { state, map, stack } = build();
    const back = vi.spyOn(stack, 'back').mockImplementation(() => undefined);
    state.show('find', 'fund-eins');

    state.close();

    expect(map.object()).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('geht ohne offenes Objekt nicht zurück', () => {
    const { state, stack } = build();
    const back = vi.spyOn(stack, 'back').mockImplementation(() => undefined);

    state.close();

    expect(back).not.toHaveBeenCalled();
  });

  it('schließt, wenn die Browser-Geste zurück greift', () => {
    const { state, map } = build();
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    state.show('marker', 'marker-eins');

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(map.object()).toBeNull();
  });
});
