import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { OBJECT_COLOURS } from '../../ui/colour-swatches/colour-swatches.component';
import { colourSwatches, colourFromHex, colourHex } from './colors';

describe('Farben', () => {
  it('bildet jede Farbe des Vertrags auf ihren Wert ab und zurück', () => {
    expect(colourHex('green')).toBe(OBJECT_COLOURS[0]);
    expect(colourHex('grey')).toBe(OBJECT_COLOURS[5]);
    expect(colourFromHex(OBJECT_COLOURS[2])).toBe('blue');
  });

  it('fällt auf Grün zurück, wenn eine Farbe unbekannt ist', () => {
    expect(colourHex('lila' as 'green')).toBe(OBJECT_COLOURS[0]);
    expect(colourFromHex('#123456')).toBe('green');
  });

  it('gibt jedem Farbfeld einen Namen für den Bildschirmleser', () => {
    const fields = colourSwatches(TestBed.inject(I18nService));

    expect(fields).toHaveLength(6);
    expect(fields[0]).toEqual({ value: OBJECT_COLOURS[0], label: 'Grün' });
  });
});
