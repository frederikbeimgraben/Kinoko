import { TestBed } from '@angular/core/testing';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { MapStore } from '../map/map.store';
import { ObjectSheetStore } from './object-sheet.store';

function build(): { state: ObjectSheetStore; map: MapStore; stack: OverlayStackService } {
  return {
    state: TestBed.inject(ObjectSheetStore),
    map: TestBed.inject(MapStore),
    stack: TestBed.inject(OverlayStackService),
  };
}

describe('ObjectSheetStore', () => {
  it('adds a history entry on open', () => {
    const { state, map, stack } = build();
    const open = vi.spyOn(stack, 'open');

    state.show('marker', 'marker-eins');

    expect(map.object()).toEqual({ kind: 'marker', id: 'marker-eins' });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('adds no second entry for a change to another object', () => {
    const { state, stack } = build();
    const open = vi.spyOn(stack, 'open');
    state.show('marker', 'marker-eins');

    state.show('zone', 'zone-eins');

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('goes back one step on close', () => {
    const { state, map, stack } = build();
    const back = vi.spyOn(stack, 'back').mockImplementation(() => undefined);
    state.show('find', 'fund-eins');

    state.close();

    expect(map.object()).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('ends the corner editing on close and on a new object', () => {
    const { state } = build();
    vi.spyOn(TestBed.inject(OverlayStackService), 'back').mockImplementation(() => undefined);
    state.show('zone', 'zone-eins');
    state.setEditingCorners(true);

    state.show('zone', 'zone-zwei');
    expect(state.editingCorners()).toBe(false);

    state.setEditingCorners(true);
    state.close();
    expect(state.editingCorners()).toBe(false);
  });

  it('does not go back without an open object', () => {
    const { state, stack } = build();
    const back = vi.spyOn(stack, 'back').mockImplementation(() => undefined);

    state.close();

    expect(back).not.toHaveBeenCalled();
  });

  it('closes on the back gesture of the browser', () => {
    const { state, map } = build();
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    state.show('marker', 'marker-eins');

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(map.object()).toBeNull();
  });
});
