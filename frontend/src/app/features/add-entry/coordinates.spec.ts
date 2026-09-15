import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { coordinatesText } from './coordinates';

describe('Koordinaten', () => {
  it('schreibt Breite vor Länge in der Schreibweise der Sprache', () => {
    expect(coordinatesText([9.0511, 48.5203], TestBed.inject(I18nService))).toBe('48,5203 · 9,0511');
  });

  it('bleibt leer, solange kein Ort feststeht', () => {
    expect(coordinatesText(null, TestBed.inject(I18nService))).toBe('');
  });
});
