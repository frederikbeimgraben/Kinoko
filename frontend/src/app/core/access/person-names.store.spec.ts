import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import type { PersonName } from '../api/models';
import { PersonNamesStore, chunks, withAnswer } from './person-names.store';

function build(): { names: PersonNamesStore; api: AccessApiDouble } {
  const api = new AccessApiDouble();
  TestBed.configureTestingModule({ providers: [accessApiProvider(api)] });
  return { names: TestBed.inject(PersonNamesStore), api };
}

async function drain(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('chunks', () => {
  it('cuts a list into parts of the given size', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
  });
});

describe('withAnswer', () => {
  it('gives `null` to a requested identifier without an answer', () => {
    const names = withAnswer(new Map([['old', 'Old']]), {
      requested: ['anna', 'stranger'],
      found: [{ id: 'anna', name: 'Anna' }],
    });

    expect([...names]).toEqual([
      ['old', 'Old'],
      ['anna', 'Anna'],
      ['stranger', null],
    ]);
  });
});

describe('PersonNamesStore', () => {
  it('finds the name of a visible person after one task', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [{ id: 'anna', name: 'Anna' }];

    expect(names.nameOf('anna')).toBeNull();
    await drain();

    expect(names.nameOf('anna')).toBe('Anna');
    expect(api.personNamesCalls).toEqual([['anna']]);
  });

  it('collects the identifiers of one task into one request', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [
      { id: 'anna', name: 'Anna' },
      { id: 'bert', name: 'Bert' },
    ];

    names.nameOf('anna');
    names.nameOf('bert');
    await drain();

    expect(api.personNamesCalls).toEqual([['anna', 'bert']]);
    expect(names.nameOf('anna')).toBe('Anna');
    expect(names.nameOf('bert')).toBe('Bert');
  });

  it('sends at most 50 identifiers in one request', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [];
    const ids = Array.from({ length: 51 }, (_, index) => `id-${String(index)}`);

    ids.forEach((id) => names.nameOf(id));
    await drain();

    expect(api.personNamesCalls.map((call) => call.length)).toEqual([50, 1]);
  });

  it('has no name for a person without a shared group', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [] as PersonName[];

    names.nameOf('stranger');
    await drain();

    expect(names.nameOf('stranger')).toBeNull();
    expect(api.personNamesCalls).toEqual([['stranger']]);
  });

  it('does not ask for the same identifier two times', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [{ id: 'anna', name: 'Anna' }];

    names.nameOf('anna');
    await drain();
    names.nameOf('anna');
    await drain();

    expect(api.personNamesCalls).toEqual([['anna']]);
  });

  it('has no name when the request fails', async () => {
    const { names, api } = build();
    api.personNamesFails = true;

    names.nameOf('anna');
    await drain();

    expect(names.nameOf('anna')).toBeNull();
  });

  it('gives no name and asks nothing for an empty identifier', async () => {
    const { names, api } = build();

    expect(names.nameOf(null)).toBeNull();
    await drain();

    expect(api.personNamesCalls).toEqual([]);
  });

  it('reads a patched name without a request', async () => {
    const { names, api } = build();

    patchState(unprotected(names), { names: new Map([['anna', 'Anna']]) });
    await drain();

    expect(names.nameOf('anna')).toBe('Anna');
    expect(api.personNamesCalls).toEqual([]);
  });
});
