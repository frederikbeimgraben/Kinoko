import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { memberCount } from './group-text';

describe('memberCount', () => {
  it('nennt die Zahl, im Einzelfall ohne sie', () => {
    TestBed.configureTestingModule({});
    const i18n = TestBed.inject(I18nService);

    expect(memberCount(i18n, 1)).toBe('1 Mitglied');
    expect(memberCount(i18n, 4)).toBe('4 Mitglieder');
  });
});
