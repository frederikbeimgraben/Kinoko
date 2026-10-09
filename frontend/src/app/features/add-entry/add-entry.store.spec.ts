import { TestBed } from '@angular/core/testing';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { EMPTY_FIND_DRAFT } from './find-draft';
import { AddEntryStore } from './add-entry.store';

function state(): AddEntryStore {
  return TestBed.inject(AddEntryStore);
}

describe('AddEntryStore', () => {
  it('starts with the actions sheet and makes the map dark', () => {
    const flow = state();

    flow.open();

    expect(flow.step()).toBe('actions');
    expect(flow.running()).toBe(true);
    expect(flow.dark()).toBe(true);
    expect(flow.showsCrosshair()).toBe(false);
  });

  it('goes from the find location to the find form', () => {
    const flow = state();

    flow.startFind();
    expect(flow.showsCrosshair()).toBe(true);
    expect(flow.dark()).toBe(false);
    flow.adoptLocation([9.05, 48.52]);

    expect(flow.step()).toBe('findForm');
    expect(flow.location()).toEqual([9.05, 48.52]);
  });

  it('goes from the marker location to the marker form', () => {
    const flow = state();

    flow.startMarker();
    flow.adoptLocation([9.06, 48.53]);

    expect(flow.step()).toBe('markerForm');
  });

  it('collects corners and removes the last one', () => {
    const flow = state();

    flow.startZone();
    flow.addCorner([9.0, 48.5]);
    flow.addCorner([9.1, 48.5]);
    flow.removeLastCorner();

    expect(flow.ring()).toEqual([[9.0, 48.5]]);
    expect(flow.ringClosed()).toBe(false);
  });

  it('closes a zone only with three corners or more', () => {
    const flow = state();
    flow.startZone();
    flow.addCorner([9.0, 48.5]);
    flow.addCorner([9.1, 48.5]);

    expect(flow.closeZone()).toBe(false);

    flow.addCorner([9.1, 48.6]);

    expect(flow.closeZone()).toBe(true);
    expect(flow.step()).toBe('zoneForm');
  });

  it('accepts a ring that Terra Draw moved', () => {
    const flow = state();
    flow.startZone();

    flow.setRing([
      [9.0, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);

    expect(flow.ring()).toHaveLength(3);
  });

  it('goes back from each form to the step before it', () => {
    const flow = state();

    flow.startFind();
    flow.adoptLocation([9, 48]);
    flow.back();
    expect(flow.step()).toBe('findLocation');

    flow.startMarker();
    flow.adoptLocation([9, 48]);
    flow.back();
    expect(flow.step()).toBe('markerLocation');

    flow.startZone();
    flow.setRing([
      [9, 48],
      [9.1, 48],
      [9.1, 48.1],
    ]);
    flow.closeZone();
    flow.back();
    expect(flow.step()).toBe('zoneDraw');

    flow.back();
    expect(flow.step()).toBeNull();
  });

  it('returns to the find location with the draft, and clears the point unless asked to keep it', () => {
    const flow = state();
    const draft = { ...EMPTY_FIND_DRAFT, note: 'Unter Fichten' };

    flow.startFind();
    flow.adoptLocation([9, 48]);
    flow.editFindLocation(draft, false);
    expect([flow.step(), flow.location(), flow.findDraft()]).toEqual(['findLocation', null, draft]);

    flow.adoptLocation([9.1, 48.1]);
    flow.editFindLocation(draft, true);
    expect(flow.location()).toEqual([9.1, 48.1]);

    flow.startFind();
    expect(flow.findDraft()).toEqual(EMPTY_FIND_DRAFT);
  });

  it('keeps the marker values while the crosshair sets the point again', () => {
    const flow = state();
    const draft = {
      name: 'Alter Fichtenbestand',
      colour: 'orange',
      note: null,
      visibility: 'private',
      groupId: null,
    } as const;

    flow.startMarker();
    flow.adoptLocation([9, 48]);
    flow.editMarkerLocation(draft);
    expect([flow.step(), flow.location(), flow.objectDraft()]).toEqual(['markerLocation', null, draft]);

    flow.adoptLocation([9.2, 48.2]);
    expect([flow.step(), flow.objectDraft()]).toEqual(['markerForm', draft]);

    flow.startMarker();
    expect(flow.objectDraft()).toBeNull();
  });

  it('keeps the corners and the zone values for "Umriss ändern"', () => {
    const flow = state();
    const draft = {
      name: 'Schönbuch Nord',
      colour: 'green',
      note: null,
      visibility: 'private',
      groupId: null,
    } as const;
    flow.startZone();
    flow.addCorner([9, 48]);
    flow.addCorner([9.1, 48]);
    flow.addCorner([9.1, 48.1]);
    flow.closeZone();

    flow.editZoneOutline(draft);

    expect([flow.step(), flow.ring().length, flow.objectDraft()]).toEqual(['zoneDraw', 3, draft]);
  });

  it('adds a history step on open and removes it on stop', () => {
    const stack = TestBed.inject(OverlayStackService);
    const opened = vi.spyOn(stack, 'open');
    const back = vi.spyOn(stack, 'back');
    const flow = state();

    flow.open();
    expect(opened).toHaveBeenCalledOnce();

    flow.stop();
    expect(back).toHaveBeenCalledOnce();
  });

  it('clears the point and the corners on stop', () => {
    const flow = state();
    flow.startZone();
    flow.addCorner([9, 48]);

    flow.stop();

    expect(flow.step()).toBeNull();
    expect(flow.ring()).toEqual([]);
    expect(flow.location()).toBeNull();
  });

  it('clears when the tab closes and keeps the history', () => {
    const stack = TestBed.inject(OverlayStackService);
    const back = vi.spyOn(stack, 'back');
    const flow = state();
    flow.open();
    flow.startFind();

    flow.abandon();

    expect(flow.step()).toBeNull();
    expect(flow.running()).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });
});
