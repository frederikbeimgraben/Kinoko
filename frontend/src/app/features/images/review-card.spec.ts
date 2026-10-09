import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { photo } from '../../testing/photos-fixture';
import { PENNY_BUN } from '../../testing/species-fixture';
import { licenceText, reviewCard } from './review-card';

function i18n(): I18nService {
  return TestBed.inject(I18nService);
}

describe('review-card', () => {
  it('nennt eine fremde Lizenz als Kennung', () => {
    expect(licenceText(photo({ licence: 'cc_by_4' }), i18n())).toBe('CC BY 4.0');
  });

  it('schreibt ein eigenes Foto aus', () => {
    expect(licenceText(photo({ licence: 'own' }), i18n())).toBe('Eigenes Foto');
  });

  it('zeigt Urheber, Lizenz und den Tag der Einreichung wie das Board ImageQueue', () => {
    const card = reviewCard(photo({ caption: 'Junge Exemplare im Moos' }), PENNY_BUN, i18n());
    expect(card.species).toBe('Steinpilz');
    expect(card.caption).toBe('Junge Exemplare im Moos');
    expect(card.rows).toEqual([
      { label: 'Urheber', value: 'Marie Weber' },
      { label: 'Lizenz', value: 'CC BY-SA 4.0' },
      { label: 'Eingereicht', value: '9. September' },
    ]);
  });

  it('nimmt ohne Unterschrift den Namen der Art als Bildbeschreibung', () => {
    expect(reviewCard(photo(), PENNY_BUN, i18n()).alt).toBe('Steinpilz');
  });

  it('nennt ein Bild ohne bekannte Art unbestimmt', () => {
    expect(reviewCard(photo({ speciesId: null }), null, i18n()).species).toBe('Unbestimmte Art');
  });

  it('führt zum vollen Bild', () => {
    expect(reviewCard(photo(), PENNY_BUN, i18n()).path).toBe('/photos/bild-eins/full');
  });
});
