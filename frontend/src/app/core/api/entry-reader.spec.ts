import { FIND, FIND_ENTRY, MARKER, MARKER_ENTRY, ZONE, ZONE_ENTRY } from '../../testing/entries-fixture';
import { marker, ownFind, sharedFind, zone } from './entry-reader';

describe('EintragLeser', () => {
  it('liest einen geteilten Fund des Vertrags', () => {
    expect(sharedFind(FIND_ENTRY)).toEqual({
      id: FIND.id,
      ownerId: FIND.ownerId,
      speciesId: FIND.speciesId,
      lat: FIND.lat,
      lon: FIND.lon,
      foundOn: FIND.foundOn,
      count: FIND.count,
      note: FIND.note,
      reviewState: FIND.reviewState,
    });
  });

  it('setzt Art, Anzahl und Notiz auf null, wo der Vertrag sie weglässt', () => {
    const lean = { ...FIND_ENTRY, speciesId: undefined, count: undefined, note: undefined };

    expect(sharedFind(lean)).toMatchObject({ speciesId: null, count: null, note: null });
  });

  it('lässt einen Fund ohne Ort, Datum, Besitzer oder Prüfstand weg', () => {
    expect(sharedFind({ ...FIND_ENTRY, lat: undefined })).toBeNull();
    expect(sharedFind({ ...FIND_ENTRY, lon: undefined })).toBeNull();
    expect(sharedFind({ ...FIND_ENTRY, foundOn: undefined })).toBeNull();
    expect(sharedFind({ ...FIND_ENTRY, ownerId: undefined })).toBeNull();
    expect(sharedFind({ ...FIND_ENTRY, reviewState: undefined })).toBeNull();
    expect(sharedFind({ ...FIND_ENTRY, deleted: true })).toBeNull();
  });

  it('liest einen eigenen Fund mit Sichtbarkeit und Freigabe', () => {
    expect(ownFind(FIND_ENTRY)).toEqual(FIND);
    expect(ownFind({ ...FIND_ENTRY, forTraining: undefined })).toMatchObject({ forTraining: false });
  });

  it('lässt einen eigenen Fund ohne Sichtbarkeit weg', () => {
    expect(ownFind({ ...FIND_ENTRY, visibility: undefined })).toBeNull();
    expect(ownFind({ ...FIND_ENTRY, lat: undefined })).toBeNull();
  });

  it('liest einen Marker und lässt einen Teilstand weg', () => {
    expect(marker(MARKER_ENTRY)).toEqual(MARKER);
    expect(marker({ ...MARKER_ENTRY, note: undefined })).toMatchObject({ note: null });
    expect(marker({ ...MARKER_ENTRY, name: undefined })).toBeNull();
    expect(marker({ ...MARKER_ENTRY, lat: undefined })).toBeNull();
    expect(marker({ ...MARKER_ENTRY, lon: undefined })).toBeNull();
    expect(marker({ ...MARKER_ENTRY, colour: undefined })).toBeNull();
    expect(marker({ ...MARKER_ENTRY, visibility: undefined })).toBeNull();
    expect(marker({ ...MARKER_ENTRY, deleted: true })).toBeNull();
  });

  it('liest eine Zone und lässt einen Teilstand weg', () => {
    expect(zone(ZONE_ENTRY)).toEqual(ZONE);
    expect(zone({ ...ZONE_ENTRY, note: undefined })).toMatchObject({ note: null });
    expect(zone({ ...ZONE_ENTRY, name: undefined })).toBeNull();
    expect(zone({ ...ZONE_ENTRY, polygon: undefined })).toBeNull();
    expect(zone({ ...ZONE_ENTRY, areaHa: undefined })).toBeNull();
    expect(zone({ ...ZONE_ENTRY, colour: undefined })).toBeNull();
    expect(zone({ ...ZONE_ENTRY, visibility: undefined })).toBeNull();
    expect(zone({ ...ZONE_ENTRY, deleted: true })).toBeNull();
  });
});
