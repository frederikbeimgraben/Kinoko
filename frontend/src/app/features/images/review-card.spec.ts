import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { photo } from '../../testing/photos-fixture';
import { licenceText, metaText, reviewCard } from './review-card';

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

  it('setzt Person und Tag in eine Zeile', () => {
    expect(metaText(photo(), i18n())).toBe('Marie Weber · 6. September 2026');
  });

  it('hängt den gerundeten Ort an', () => {
    expect(metaText(photo({ lat: 48.51, lon: 9.06 }), i18n())).toContain('48,51 · 9,06');
  });

  it('nimmt ohne Unterschrift den Namen der Art als Bildbeschreibung', () => {
    expect(reviewCard(photo(), 'Steinpilz', i18n()).alt).toBe('Steinpilz');
  });

  it('führt zum vollen Bild', () => {
    expect(reviewCard(photo(), 'Steinpilz', i18n()).path).toBe('/photos/bild-eins/full');
  });
});
