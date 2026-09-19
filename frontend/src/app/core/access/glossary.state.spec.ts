import { TestBed } from '@angular/core/testing';
import { GlossaryApiDouble, HYMENIUM, glossaryApiProvider } from '../../testing/glossary-fixture';
import { GlossaryState } from './glossary.state';

function build(api = new GlossaryApiDouble()): { state: GlossaryState; api: GlossaryApiDouble } {
  TestBed.configureTestingModule({ providers: [glossaryApiProvider(api)] });
  return { state: TestBed.inject(GlossaryState), api };
}

describe('GlossaryState', () => {
  it('lädt die Begriffe und findet einen über die Kennung', () => {
    const { state } = build();

    state.load();

    expect(state.entries()).toHaveLength(2);
    expect(state.one(HYMENIUM.id)?.term).toBe('Hymenium');
    expect(state.one('fehlt')).toBeNull();
  });

  it('sucht in Begriff und Erklärung', () => {
    const { state } = build();
    state.load();

    state.setSearch('blattartige');
    expect(state.found().map((one) => one.term)).toEqual(['Lamellen']);

    state.setSearch('hymen');
    expect(state.found()).toHaveLength(1);

    state.setSearch('');
    expect(state.found()).toHaveLength(2);
  });

  it('nimmt einen neuen Begriff nach Begriff geordnet auf', () => {
    const { state, api } = build();
    state.load();

    state.create({ term: 'Anhängsel', definition: 'Kurz.' }).subscribe();

    expect(api.created).toEqual([{ term: 'Anhängsel', definition: 'Kurz.' }]);
    expect(state.entries()?.[0]?.term).toBe('Anhängsel');
  });

  it('ersetzt einen geänderten Begriff und löscht einen', () => {
    const { state, api } = build();
    state.load();

    state.update(HYMENIUM.id, { term: 'Hymenium', definition: 'Neu.' }).subscribe();
    expect(state.one(HYMENIUM.id)?.definition).toBe('Neu.');

    state.remove(HYMENIUM.id).subscribe();
    expect(api.removed).toEqual([HYMENIUM.id]);
    expect(state.entries()).toHaveLength(1);
  });
});
