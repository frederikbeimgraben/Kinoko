import { TestBed } from '@angular/core/testing';
import { SpeciesFilterState } from './filter.state';

const STORAGE_KEY = 'pilzkarte.speciesfilter';

/** Was nach dem Sichern im Speicher steht. */
function stored(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
}

function build(): SpeciesFilterState {
  const state = TestBed.inject(SpeciesFilterState);
  TestBed.tick();
  return state;
}

describe('SpeciesFilterState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('beginnt ohne Wahl und mit geschlossenem Blatt', () => {
    const state = build();

    expect(state.chosenCount()).toBe(0);
    expect(state.open()).toBe(false);
    expect(state.group()).toBeNull();
  });

  it('wählt einen Wert und wählt ihn wieder ab', () => {
    const state = build();

    state.toggle('hymenium', 'tubes');
    expect([...state.chosenIn('hymenium')]).toEqual(['tubes']);

    state.toggle('hymenium', 'tubes');
    expect(state.chosenIn('hymenium').size).toBe(0);
    expect(state.chosenCount()).toBe(0);
  });

  it('zählt Werte, Farben und Spannen zusammen', () => {
    const state = build();

    state.toggle('hymenium', 'tubes');
    state.toggle('hymenium', 'gills');
    state.setColour('cap', '#6b4423');
    state.setSize('cap.width', [2, 8]);

    expect(state.chosenCount()).toBe(4);
    expect(state.colourOf('cap')).toBe('#6b4423');
    expect(state.sizeOf('cap.width')).toEqual([2, 8]);
  });

  it('nimmt dieselbe Farbe beim zweiten Griff wieder weg', () => {
    const state = build();

    state.setColour('cap', '#6b4423');
    state.setColour('cap', '#6b4423');

    expect(state.colourOf('cap')).toBeNull();
  });

  it('nimmt einen einzelnen Wert und eine Farbe über die Marke weg', () => {
    const state = build();
    state.toggle('hymenium', 'tubes');
    state.setColour('cap', '#6b4423');

    state.dropValue('hymenium', 'tubes');
    state.dropColour('cap');

    expect(state.chosenCount()).toBe(0);
  });

  it('räumt mit clearAll jede Wahl weg', () => {
    const state = build();
    state.toggle('hymenium', 'tubes');
    state.setColour('cap', '#6b4423');
    state.setSize('cap.width', [2, 8]);
    state.toggleKeepUnknown('hymenium');

    state.clearAll();

    expect(state.chosenCount()).toBe(0);
    expect(state.keeps('hymenium')).toBe(false);
  });

  it('schaltet das Behalten fehlender Angaben je Gruppe', () => {
    const state = build();

    state.toggleKeepUnknown('size');
    expect(state.keeps('size')).toBe(true);

    state.toggleKeepUnknown('size');
    expect(state.keeps('size')).toBe(false);
  });

  it('öffnet das Blatt auf der Übersicht und zeigt darin eine Gruppe', () => {
    const state = build();

    state.openSheet();
    expect(state.open()).toBe(true);
    expect(state.group()).toBeNull();

    state.showGroup('capShape');
    expect(state.group()).toBe('capShape');

    state.closeSheet();
    expect(state.open()).toBe(false);
    expect(state.group()).toBeNull();
  });

  it('sichert die Wahl im Speicher', () => {
    const state = build();

    state.toggle('hymenium', 'tubes');
    state.setColour('cap', '#6b4423');
    state.setSize('cap.width', [2, 8]);
    state.toggleKeepUnknown('hymenium');
    TestBed.tick();

    expect(stored()).toEqual({
      values: { hymenium: ['tubes'] },
      colours: { cap: '#6b4423' },
      sizes: { 'cap.width': [2, 8] },
      keepUnknown: ['hymenium'],
    });
  });

  it('liest die gesicherte Wahl beim Start', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        values: { hymenium: ['tubes'] },
        colours: { cap: '#6b4423' },
        sizes: { 'cap.width': [2, 8] },
        keepUnknown: ['hymenium'],
      }),
    );

    const state = build();

    expect([...state.chosenIn('hymenium')]).toEqual(['tubes']);
    expect(state.colourOf('cap')).toBe('#6b4423');
    expect(state.sizeOf('cap.width')).toEqual([2, 8]);
    expect(state.keeps('hymenium')).toBe(true);
  });

  it('verwirft einen kaputten Speicherinhalt', () => {
    localStorage.setItem(STORAGE_KEY, '{kein json');

    expect(build().chosenCount()).toBe(0);
  });

  it('verwirft einzelne Werte in falscher Form', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        values: { hymenium: [], keineGruppe: ['x'] },
        sizes: { 'cap.width': ['a', 'b'] },
        keepUnknown: ['keineGruppe'],
      }),
    );

    const state = build();

    expect(state.chosenCount()).toBe(0);
    expect(state.keeps('hymenium')).toBe(false);
  });
});
