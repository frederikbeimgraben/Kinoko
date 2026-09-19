import { geoUri, googleMapsUrl, osmUrl } from './map-links';

describe('googleMapsUrl', () => {
  it('stellt die Breite vor die Länge, wie Google Maps sie liest', () => {
    expect(googleMapsUrl([9.1829, 48.7758])).toBe(
      'https://www.google.com/maps/search/?api=1&query=48.775800%2C9.182900',
    );
  });

  it('kappt die Stellen bei elf Zentimetern', () => {
    expect(googleMapsUrl([9.123456789, 48.987654321])).toContain('48.987654%2C9.123457');
  });
});

describe('osmUrl', () => {
  it('trägt Breite und Länge in Punkt und Kartenausschnitt', () => {
    expect(osmUrl([9.1829, 48.7758])).toBe(
      'https://www.openstreetmap.org/?mlat=48.775800&mlon=9.182900#map=17/48.775800/9.182900',
    );
  });
});

describe('geoUri', () => {
  it('trägt Breite vor Länge, wie das Betriebssystem sie liest', () => {
    expect(geoUri([9.1829, 48.7758])).toBe('geo:48.775800,9.182900');
  });
});
