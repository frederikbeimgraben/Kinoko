import { speciesEntry } from '../../testing/species-fixture';
import { capColour, FALLBACK_COLOUR } from './cap-colour';

function withCap(...hexes: string[]) {
  return speciesEntry({
    slug: 'steinpilz',
    name: 'Steinpilz',
    scientificName: 'Boletus edulis',
    colours: [{ part: 'cap', mode: 'gradient', colours: hexes.map((hex) => ({ name: hex, hex })) }],
  });
}

describe('capColour', () => {
  it('nimmt den ersten Ton, der auf der Fläche sichtbar bleibt', () => {
    expect(capColour(withCap('#ffffff', '#7a5230'))).toBe('#7a5230');
  });

  it('behält einen hellen Ton, wenn die Art keinen anderen hat', () => {
    expect(capColour(withCap('#f4efe4'))).toBe('#f4efe4');
  });

  it('nimmt das Braun der Boards ohne Art oder ohne Hutfarbe', () => {
    expect(capColour(null)).toBe(FALLBACK_COLOUR);
    expect(capColour(withCap())).toBe(FALLBACK_COLOUR);
  });
});
