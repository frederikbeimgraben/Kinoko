import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { openFind } from '../../testing/open-finds-fixture';
import { photo } from '../../testing/photos-fixture';
import { dayAndMonth, findCard } from './find-card';

function i18n(): I18nService {
  TestBed.configureTestingModule({});
  return TestBed.inject(I18nService);
}

describe('findCard', () => {
  it('names the reporter, and tells when the name is not known', () => {
    const texts = i18n();

    expect(findCard(openFind({ id: 'a' }), null, [], texts).rows[0]).toEqual({
      label: 'Melder',
      value: 'Frederik',
    });
    expect(findCard(openFind({ id: 'b', ownerName: null }), null, [], texts).rows[0].value).toBe('Unbekannt');
  });

  it('gives a find without a species a title and the default colour', () => {
    const card = findCard(openFind({ id: 'a', speciesId: null }), null, [], i18n());

    expect(card.species).toBe('Unbestimmte Art');
    expect(card.colour).toBe('#7a5230');
    expect(card.point).toEqual([9.0511, 48.5203]);
  });

  it('shows the lead photo in the thumb', () => {
    const photos = [photo({ id: 'one', lead: false }), photo({ id: 'two', lead: true })];

    expect(findCard(openFind({ id: 'a' }), null, photos, i18n()).photo).toContain('two');
  });

  it('writes the day with the full month', () => {
    expect(dayAndMonth('2026-09-06', 'de')).toBe('6. September');
    expect(dayAndMonth('2026-09-06', 'en')).toBe('September 6');
  });
});
