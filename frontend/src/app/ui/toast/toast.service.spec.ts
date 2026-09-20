import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('meldet einen Erfolg', () => {
    const toasts = TestBed.inject(ToastService);

    toasts.success('Gespeichert');

    expect(toasts.toasts()).toEqual([{ id: expect.any(Number), message: 'Gespeichert', variant: 'success' }]);
  });

  it('meldet einen Fehler', () => {
    const toasts = TestBed.inject(ToastService);

    toasts.error('Kaputt');

    expect(toasts.toasts()[0].variant).toBe('danger');
  });

  it('trägt mehrere Meldungen gleichzeitig', () => {
    const toasts = TestBed.inject(ToastService);

    toasts.success('Erste');
    toasts.error('Zweite');

    expect(toasts.toasts()).toHaveLength(2);
  });

  it('nimmt eine Meldung nach der Frist selbst zurück', () => {
    vi.useFakeTimers();
    const toasts = TestBed.inject(ToastService);

    toasts.success('Gespeichert');
    vi.advanceTimersByTime(4000);

    expect(toasts.toasts()).toHaveLength(0);
    vi.useRealTimers();
  });

  it('nimmt eine Meldung sofort zurück', () => {
    const toasts = TestBed.inject(ToastService);

    const id = toasts.success('Gespeichert');
    toasts.dismiss(id);

    expect(toasts.toasts()).toHaveLength(0);
  });
});
