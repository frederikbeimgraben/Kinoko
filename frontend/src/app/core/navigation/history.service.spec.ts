import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HistoryService } from './history.service';

interface Setup {
  history: HistoryService;
  back: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

function build(previous: unknown): Setup {
  const back = vi.fn();
  const navigate = vi.fn(() => Promise.resolve(true));
  TestBed.configureTestingModule({
    providers: [
      { provide: Location, useValue: { back } },
      {
        provide: Router,
        useValue: { lastSuccessfulNavigation: () => ({ previousNavigation: previous }), navigate },
      },
    ],
  });
  return { history: TestBed.inject(HistoryService), back, navigate };
}

describe('HistoryService', () => {
  it('geht einen Schritt zurück, wenn die App schon eine Seite hinter sich hat', () => {
    const { history, back, navigate } = build({});

    history.back(['/arten', 'boletus-edulis']);

    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ersetzt den Eintrag mit dem Ausgangspunkt, wenn der Verlauf leer ist', () => {
    const { history, back, navigate } = build(null);

    history.back(['/arten', 'boletus-edulis']);

    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/arten', 'boletus-edulis'], { replaceUrl: true });
  });
});
