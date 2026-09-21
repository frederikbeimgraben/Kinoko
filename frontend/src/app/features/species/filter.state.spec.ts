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

  it('zählt Werte und Farben zusammen', () => {
    const state = build();

    state.toggle('hymenium', 'tubes');
    state.toggle('hymenium', 'gills');
    state.setColour('cap', '#6b4423');

    expect(state.chosenCount()).toBe(3);
    expect(state.colourOf('cap')).toBe('#6b4423');
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
    state.toggleKeepUnknown('hymenium');

    state.clearAll();

    expect(state.chosenCount()).toBe(0);
    expect(state.keeps('hymenium')).toBe(false);
  });

  it('schaltet das Behalten fehlender Angaben je Gruppe', () => {
    const state = build();

    state.toggleKeepUnknown('capShape');
    expect(state.keeps('capShape')).toBe(true);

    state.toggleKeepUnknown('capShape');
    expect(state.keeps('capShape')).toBe(false);
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

  it('legt für das Blatt und für eine Gruppe je einen Verlaufseintrag an', () => {
    const state = build();
    const pushState = vi.spyOn(history, 'pushState');

    state.openSheet();
    expect(pushState).toHaveBeenCalledTimes(1);

    state.showGroup('capShape');
    expect(pushState).toHaveBeenCalledTimes(2);
  });

  it('geht beim Verlassen einer Gruppe einen Schritt in der Adresszeile zurück', () => {
    const state = build();
    const back = vi.spyOn(history, 'back');
    state.openSheet();
    state.showGroup('capShape');

    state.showGroup(null);

    expect(back).toHaveBeenCalledTimes(1);
    expect(state.open()).toBe(true);
    expect(state.group()).toBeNull();
  });

  it('räumt beim Schließen des Blatts jede Ebene aus dem Verlauf', () => {
    const state = build();
    const go = vi.spyOn(history, 'go');
    state.openSheet();
    state.showGroup('capShape');

    state.closeSheet();

    expect(go).toHaveBeenCalledWith(-2);
  });

  it('schließt die Gruppe, wenn die Browser-Geste zurück den Eintrag der Gruppe trifft', () => {
    const state = build();
    state.openSheet();
    state.showGroup('capShape');

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(state.open()).toBe(true);
    expect(state.group()).toBeNull();
  });

  it('sichert die Wahl im Speicher', () => {
    const state = build();

    state.toggle('hymenium', 'tubes');
    state.setColour('cap', '#6b4423');
    state.toggleKeepUnknown('hymenium');
    TestBed.tick();

    expect(stored()).toEqual({
      values: { hymenium: ['tubes'] },
      colours: { cap: '#6b4423' },
      keepUnknown: ['hymenium'],
    });
  });

  it('liest die gesicherte Wahl beim Start', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        values: { hymenium: ['tubes'] },
        colours: { cap: '#6b4423' },
        keepUnknown: ['hymenium'],
      }),
    );

    const state = build();

    expect([...state.chosenIn('hymenium')]).toEqual(['tubes']);
    expect(state.colourOf('cap')).toBe('#6b4423');
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
        keepUnknown: ['keineGruppe'],
      }),
    );

    const state = build();

    expect(state.chosenCount()).toBe(0);
    expect(state.keeps('hymenium')).toBe(false);
  });
});
