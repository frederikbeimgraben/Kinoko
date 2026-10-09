import { GILL_ONLY, HYMENIUM_TYPES_ORDER, choiceText, choicesOf } from './section-hymenium.rows';

describe('section-hymenium.rows', () => {
  it('führt die Arten in der Folge des Boards', () => {
    expect(HYMENIUM_TYPES_ORDER).toEqual(['tubes', 'gills', 'folds', 'spines', 'pores']);
    expect(GILL_ONLY).toEqual(['gills', 'folds']);
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
});
