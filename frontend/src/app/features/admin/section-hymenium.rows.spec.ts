import type { SpeciesEntry } from '../../core/api/models';
import { choiceText, choicesOf, hymeniumRows, valueOf } from './section-hymenium.rows';

const GILLS = {
  hymeniumType: 'gills',
  gillAttachment: 'free',
  gillSpacing: 'close',
  gillEdge: 'smooth',
} as unknown as SpeciesEntry;

const TUBES = { hymeniumType: 'tubes' } as unknown as SpeciesEntry;

function text(key: string): string {
  return key;
}

describe('section-hymenium.rows', () => {
  it('führt bei Lamellen vier Zeilen, sonst nur die Art', () => {
    expect(hymeniumRows(GILLS, text).map((row) => row.field)).toEqual([
      'kind',
      'attachment',
      'spacing',
      'edge',
    ]);
    expect(hymeniumRows(TUBES, text).map((row) => row.field)).toEqual(['kind']);
  });

  it('nennt den Wert jedes Feldes', () => {
    expect(valueOf(GILLS, 'kind')).toBe('gills');
    expect(valueOf(GILLS, 'attachment')).toBe('free');
    expect(valueOf(GILLS, 'spacing')).toBe('close');
    expect(valueOf(GILLS, 'edge')).toBe('smooth');
    expect(valueOf(TUBES, 'attachment')).toBeNull();
  });

  it('gibt zu jedem Feld seine Werte und deren Schlüssel', () => {
    expect(choicesOf('attachment')).toEqual(['free', 'adnate', 'emarginate', 'decurrent']);
    expect(choicesOf('spacing')).toEqual(['close', 'normal', 'distant']);
    expect(choicesOf('edge')).toEqual(['smooth', 'serrate', 'ciliate']);
    expect(choiceText('kind', 'gills')).toBe('enum.hymenium.gills');
    expect(choiceText('attachment', 'free')).toBe('species.attachment.free');
    expect(choiceText('spacing', 'close')).toBe('enum.gill_spacing.close');
    expect(choiceText('edge', 'smooth')).toBe('enum.gill_edge.smooth');
  });

  it('lässt den Wert leer, wenn die Art ihn nicht trägt', () => {
    const rows = hymeniumRows({ ...TUBES, hymeniumType: null }, text);

    expect(rows[0].value).toBe('');
  });
});
