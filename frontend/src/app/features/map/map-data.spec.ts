import { manifestState, mapData } from './map-data';

describe('manifestState', () => {
  it('gibt dem vorhandenen Manifest Vorrang', () => {
    expect(manifestState(true, true, true)).toBe('data');
    expect(manifestState(false, true, true)).toBe('missing');
    expect(manifestState(false, false, true)).toBe('failed');
    expect(manifestState(false, false, false)).toBe('pending');
  });
});

describe('mapData', () => {
  it('ist leer, wenn kein Manifest am Ursprung liegt', () => {
    expect(mapData(['missing', 'missing'])).toEqual({ loading: false, failed: false, empty: true });
  });

  it('bietet einen neuen Versuch, wenn ein Manifest ohne Antwort blieb und keines da ist', () => {
    expect(mapData(['missing', 'failed'])).toEqual({ loading: false, failed: true, empty: false });
    expect(mapData(['failed', 'failed'])).toEqual({ loading: false, failed: true, empty: false });
  });

  it('lädt, solange eine Antwort aussteht und noch nichts da ist', () => {
    expect(mapData(['pending', 'failed'])).toEqual({ loading: true, failed: false, empty: false });
    expect(mapData(['pending', 'missing'])).toEqual({ loading: true, failed: false, empty: false });
  });

  it('zeigt die Karte, sobald ein Manifest da ist', () => {
    expect(mapData(['data', 'missing'])).toEqual({ loading: false, failed: false, empty: false });
    expect(mapData(['failed', 'data'])).toEqual({ loading: false, failed: false, empty: false });
  });
});
