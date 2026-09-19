import { TestBed } from '@angular/core/testing';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import type { PersonName } from '../api/models';
import { PersonNamesService } from './person-names.service';

function build(): { names: PersonNamesService; api: AccessApiDouble } {
  const api = new AccessApiDouble();
  TestBed.configureTestingModule({ providers: [accessApiProvider(api)] });
  return { names: TestBed.inject(PersonNamesService), api };
}

async function drain(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PersonNamesService', () => {
  it('löst den Namen einer sichtbaren Person auf, nach einem Umlauf', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [{ id: 'anna', name: 'Anna' }];

    expect(names.nameOf('anna')).toBeNull();
    await drain();

    expect(names.nameOf('anna')).toBe('Anna');
    expect(api.personNamesCalls).toEqual([['anna']]);
  });

  it('bündelt mehrere Anfragen aus demselben Umlauf in einen Aufruf', async () => {
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

  it('bleibt ohne Namen für eine Person ohne gemeinsame Gruppe', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [] as PersonName[];

    names.nameOf('fremd');
    await drain();

    expect(names.nameOf('fremd')).toBeNull();
    expect(api.personNamesCalls).toEqual([['fremd']]);
  });

  it('fragt dieselbe Kennung nicht zweimal', async () => {
    const { names, api } = build();
    api.personNamesAnswer = [{ id: 'anna', name: 'Anna' }];

    names.nameOf('anna');
    await drain();
    names.nameOf('anna');
    await drain();

    expect(api.personNamesCalls).toEqual([['anna']]);
  });

  it('bleibt ohne Namen, wenn der Abruf scheitert', async () => {
    const { names, api } = build();
    api.personNamesFails = true;

    names.nameOf('anna');
    await drain();

    expect(names.nameOf('anna')).toBeNull();
  });

  it('liefert für eine leere Kennung keinen Namen und fragt nichts', async () => {
    const { names, api } = build();

    expect(names.nameOf(null)).toBeNull();
    await drain();

    expect(api.personNamesCalls).toEqual([]);
  });
});
