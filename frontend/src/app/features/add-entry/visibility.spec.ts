import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { visibilitySegments, visibilityText } from './visibility';

describe('Sichtbarkeit', () => {
  it('baut die zwei Segmente aus den Mockups', () => {
    expect(visibilitySegments(TestBed.inject(I18nService))).toEqual([
      { value: 'private', label: 'Privat' },
      { value: 'shared', label: 'Geteilt' },
    ]);
  });

  it('schreibt die Sichtbarkeit in der Unterzeile klein', () => {
    expect(visibilityText(TestBed.inject(I18nService), 'private')).toBe('privat');
  });
});
