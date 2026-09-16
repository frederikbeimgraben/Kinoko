import { EMPTY_DRAFT, sourceTitle, toWrite } from './species-create.draft';

describe('species-create.draft', () => {
  it('nimmt den Rechnernamen der Quelle ohne www als Titel', () => {
    expect(sourceTitle('https://www.123pilzsuche.de/daten/details/Schopftintling.htm')).toBe(
      '123pilzsuche.de',
    );
    expect(sourceTitle('123pilzsuche.de/daten/details/Schopftintling.htm')).toBe('123pilzsuche.de');
    expect(sourceTitle('   ')).toBe('');
  });

  it('trägt Name, Gattung und Speisewert in den Vertrag', () => {
    const write = toWrite(
      { ...EMPTY_DRAFT, name: 'Schopftintling', scientificName: 'Coprinus comatus' },
      '2026-09-15',
    );
    expect(write.name).toBe('Schopftintling');
    expect(write.scientificName).toBe('Coprinus comatus');
    expect(write.protection).toBe('none');
    expect(write.names).toEqual([]);
    expect(write.sources).toEqual([]);
  });

  it('teilt weitere Namen am Komma und merkt sie als Synonym', () => {
    const write = toWrite({ ...EMPTY_DRAFT, otherNames: 'Porzellantintling ,  Spargelpilz ' }, '2026-09-15');
    expect(write.names).toEqual([
      { name: 'Porzellantintling', kind: 'synonym' },
      { name: 'Spargelpilz', kind: 'synonym' },
    ]);
  });

  it('macht aus dem Haken den Schutz nach BArtSchV', () => {
    expect(toWrite({ ...EMPTY_DRAFT, protected: true }, '2026-09-15').protection).toBe('personal_use');
  });

  it('legt die Quelle mit dem Tag der Prüfung an', () => {
    const write = toWrite({ ...EMPTY_DRAFT, source: 'https://123pilzsuche.de/a.htm' }, '2026-09-15');
    expect(write.sources).toEqual([
      {
        scope: 'profile',
        title: '123pilzsuche.de',
        url: 'https://123pilzsuche.de/a.htm',
        checkedOn: '2026-09-15',
      },
    ]);
  });
});
