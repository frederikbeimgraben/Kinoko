import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { roleName } from './role-name';

describe('roleName', () => {
  it('übersetzt eine eingebaute Rolle über ihren Schlüssel', () => {
    const i18n = TestBed.inject(I18nService);

    expect(roleName(i18n, 'account.role.admin')).toBe('Admin');
  });

  it('lässt den freien Namen einer eigenen Rolle stehen, ohne eine Meldung', () => {
    const i18n = TestBed.inject(I18nService);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(roleName(i18n, 'Pilzberater')).toBe('Pilzberater');

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
