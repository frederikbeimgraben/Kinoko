import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CombinationsApi } from '../../core/api/combinations.api';
import { AuthService } from '../../core/auth';
import { CombinationState, STORAGE_KEY } from './combination.state';
import type { Combination } from '../../core/api/models';
import type { Factor } from './factors';

const SAVED: Combination = {
  id: 'k1',
  name: 'Herbst Steinpilz',
  rule: 'intersection' as const,
  factors: [{ source: 'niederschlag', condition: 'above' as const, low: 80, high: null, active: true }],
  updatedAt: '2025-10-01T00:00:00Z',
  deleted: false,
};

function state(api: Partial<CombinationsApi> = {}, signedIn = false): CombinationState {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: CombinationsApi,
        useValue: { catalogue: () => of({ items: [], nextCursor: null }), ...api },
      },
      { provide: AuthService, useValue: { signedIn: () => signedIn } },
    ],
  });
  return TestBed.inject(CombinationState);
}

describe('CombinationState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('beginnt mit der Schnittmenge und ohne Faktoren', () => {
    const combination = state();

    expect(combination.rule()).toBe('intersection');
    expect(combination.factors()).toEqual([]);
    expect(combination.saved()).toEqual([]);
  });

  it('legt einen Faktor an, schaltet ihn und entfernt ihn', () => {
    const combination = state();

    const factor = combination.start('niederschlag', 0, 240);
    expect(factor).toEqual({ source: 'niederschlag', condition: 'above', low: 120, high: 0, active: true });
    expect(combination.active()).toHaveLength(1);

    combination.toggle(factor, false);
    expect(combination.active()).toHaveLength(0);

    combination.remove(factor);
    expect(combination.factors()).toEqual([]);
  });

  it('übernimmt eine gespeicherte Kombination', () => {
    const combination = state();

    combination.pick(SAVED);

    expect(combination.rule()).toBe('intersection');
    expect(combination.factors()).toEqual<Factor[]>([
      { source: 'niederschlag', condition: 'above', low: 80, high: 0, active: true },
    ]);
  });

  it('holt die gespeicherten Kombinationen mit Konto', async () => {
    const combination = state({ catalogue: () => of({ items: [SAVED], nextCursor: null }) }, true);

    TestBed.tick();
    await vi.waitFor(() => {
      expect(combination.saved()).toHaveLength(1);
    });
  });

  it('meldet einen Fehlschlag beim Speichern', async () => {
    const combination = state({ create: () => throwError(() => new Error('weg')) }, true);

    await expect(combination.save('Name')).resolves.toBe(false);
  });

  it('speichert und löscht über den Vertrag', async () => {
    const create = vi.fn(() => of(SAVED));
    const remove = vi.fn(() => of(null));
    const combination = state({ create, remove }, true);
    TestBed.tick();
    combination.apply({ source: 'niederschlag', condition: 'above', low: 80, high: 0, active: true });

    await expect(combination.save('Herbst')).resolves.toBe(true);
    await combination.delete(SAVED);

    expect(create).toHaveBeenCalledWith({
      name: 'Herbst',
      rule: 'intersection',
      factors: [{ source: 'niederschlag', condition: 'above', low: 80, high: null, active: true }],
    });
    expect(remove).toHaveBeenCalledWith('k1');
  });

  it('übersteht einen Fehler beim Löschen', async () => {
    const combination = state({ remove: () => throwError(() => new Error('weg')) }, true);

    await expect(combination.delete(SAVED)).resolves.toBeUndefined();
  });

  it('liest einen gesicherten Stand', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rule: 'graded', factors: 'buche:ge:0.3' }));

    const combination = state();

    expect(combination.rule()).toBe('graded');
    expect(combination.factors()).toHaveLength(1);
  });

  it('verwirft einen unlesbaren Stand', () => {
    localStorage.setItem(STORAGE_KEY, '{kaputt');

    expect(state().rule()).toBe('intersection');
  });
});
