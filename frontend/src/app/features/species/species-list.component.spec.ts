import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { SpeciesListComponent } from './species-list.component';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';

interface Setup {
  container: Element;
  router: Router;
  state: SpeciesState;
  refresh: () => void;
  nachlade: (path: string, catalogue: typeof SPECIES_LIST) => void;
}

async function build(): Promise<Setup> {
  const { container, detectChanges } = await render(SpeciesListComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(SPECIES_LIST);
  detectChanges();
  const http = TestBed.inject(HttpTestingController);
  /** Der zweite Topf kommt erst, wenn Chip oder Suche ihn brauchen. */
  const nachlade = (path: string, catalogue: typeof SPECIES_LIST): void => {
    http.expectOne(path).flush(catalogue);
    detectChanges();
  };
  return {
    container,
    router: TestBed.inject(Router),
    state: TestBed.inject(SpeciesState),
    refresh: detectChanges,
    nachlade,
  };
}

/**
 * Die Namen der sichtbaren Zeilen. Nicht jede Zeile trägt eine Kurve: eine Art,
 * die niemand sammelt, hat keine Saison.
 */
function names(): string[] {
  return [...document.querySelectorAll('.row__name')].map((cell) => cell.textContent.trim());
}

describe('ArtenComponent', () => {
  it('zeigt jede Art mit lateinischem Namen und Speisewert', async () => {
    const { container } = await build();

    const row = screen.getByRole('button', { name: /Steinpilz/ });
    expect(within(row).getByText('Boletus edulis')).toBeInTheDocument();
    expect(within(row).getByText('essbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Speisemorchel/ })).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeichnet in der Liste keine Kurve mehr', async () => {
    const { container } = await build();

    // Seit D10 steht rechts das Titelbild. Auf 86 Pixeln liest die Kurve
    // ohnehin niemand ab; sie bleibt auf der Artseite.
    expect(container.querySelectorAll('.spark__all')).toHaveLength(0);
  });

  it('stellt die Arten nach Stufe und darin nach Namen auf', async () => {
    await build();

    // Vorhersage vor Saison vor Profil; die 23 Arten mit eigener Karte stehen
    // damit oben statt zwischen den Profilen verstreut.
    expect(names()).toEqual([
      'Maronenröhrling',
      'Steinpilz',
      'Semmelstoppelpilz',
      'Gallenröhrling',
      'Speisemorchel',
    ]);
  });

  it('lässt die aktive Art an ihrem Platz', async () => {
    const { state, refresh } = await build();

    state.select('speisemorchel');
    refresh();

    expect(names().at(-1)).toBe('Speisemorchel');
  });

  it('sucht in Namen und lateinischen Namen', async () => {
    const { refresh } = await build();
    const field = screen.getByLabelText('Art suchen');

    await userEvent.type(field, 'morch');
    refresh();
    expect(names()).toEqual(['Speisemorchel']);

    await userEvent.clear(field);
    await userEvent.type(field, 'Imleria');
    refresh();
    expect(names()).toEqual(['Maronenröhrling']);
  });

  it('nennt, wie viele Arten die Liste gerade zeigt', async () => {
    await build();

    expect(screen.getByText('5 Arten')).toBeInTheDocument();
  });

  it('führt zum Filterblatt, statt über der Liste einzustellen', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(navigate).toHaveBeenCalledWith(['/arten/filter']);
  });

  it('zeigt je gesetzter Gruppe eine Marke und nimmt sie auf Druck ab', async () => {
    const { refresh } = await build();
    const filter = TestBed.inject(SpeciesFilterState);

    filter.toggle('speisewert', 'essbar');
    refresh();
    const mark = screen.getByRole('button', { name: 'Speisewert nicht mehr filtern' });
    // Die zweite Anfrage geht mit dem Filter heraus.
    TestBed.inject(HttpTestingController).expectOne('/api/arten?wert=speisewert:essbar').flush(SPECIES_LIST);
    refresh();

    await userEvent.click(mark);
    refresh();

    expect(filter.any()).toBe(false);
  });

  it('zeigt auch die Arten, die niemand sammelt', async () => {
    await build();

    // Bis D9 stand der Gallenröhrling draußen und war nur über die Suche zu
    // finden. Wer einen Pilz gesehen hat und nachschlägt, weiß vorher nicht,
    // ob er sammelbar ist — das ist ja die Frage.
    expect(names()).toContain('Gallenröhrling');
    expect(screen.getByText('5 Arten')).toBeInTheDocument();
  });

  it('setzt die Arten ohne Angabe abgesetzt unter die Treffer', async () => {
    const { refresh } = await build();
    const filter = TestBed.inject(SpeciesFilterState);

    filter.toggle('hutform', 'gewoelbt');
    refresh();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/arten?wert=hutform:gewoelbt')
      .flush({
        ...SPECIES_LIST,
        arten: [SPECIES_LIST.arten[0]],
        unbeurteilbar: [SPECIES_LIST.arten[1], SPECIES_LIST.arten[2]],
        luecken: [{ schluessel: 'hutform', anzahl: 2 }],
      });
    refresh();

    // Sie fallen nicht still heraus: die Zahl steht dran, und sie stehen
    // unter den Treffern statt zwischen ihnen.
    expect(screen.getByText('Nicht beurteilbar · 2')).toBeInTheDocument();
    expect(names()).toHaveLength(3);
  });

  it('findet über die Suche auch einen Giftpilz und zeigt seinen Speisewert', async () => {
    const { refresh } = await build();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Gallen');
    refresh();

    const row = screen.getByRole('button', { name: /Gallenröhrling/ });
    expect(within(row).getByText('giftig')).toBeInTheDocument();
  });

  it('zeigt die Warnung auch an der aktiven Art', async () => {
    // Die einzige Marke der Zeile ist der Speisewert; sie bleibt an der
    // aktiven Art dieselbe wie überall sonst.
    const { state, refresh } = await build();

    const row = (): HTMLElement => screen.getByRole('button', { name: /Gallenröhrling/ });
    expect(within(row()).getByText('giftig')).toBeInTheDocument();

    state.select('gallenroehrling');
    refresh();

    expect(within(row()).getByText('giftig')).toBeInTheDocument();
  });

  it('zeigt einen Leerzustand, wenn nichts passt', async () => {
    const { refresh } = await build();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Trüffel');
    refresh();

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
  });

  it('fragt den Server, statt im Speicher zu filtern', async () => {
    // Die Regel steht auf dem Server: oder in der Gruppe, und zwischen den
    // Gruppen, dazu die Unbeurteilbaren. Zweimal gerechnet liefe sie auseinander.
    const { refresh } = await build();
    const filter = TestBed.inject(SpeciesFilterState);

    filter.toggle('speisewert', 'essbar');
    filter.toggle('speisewert', 'giftig');
    filter.toggleKeepUnknown('hutform');
    refresh();

    const call = TestBed.inject(HttpTestingController).expectOne(
      '/api/arten?wert=speisewert:essbar&wert=speisewert:giftig&ohneAngabe=hutform',
    );
    call.flush(SPECIES_LIST);

    expect(call.request.method).toBe('GET');
  });

  it('hebt die aktive Art der Karte hervor', async () => {
    const { state, refresh } = await build();

    state.select('maronenroehrling');
    refresh();

    const row = screen.getByRole('button', { name: /Maronenröhrling/ });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Steinpilz/ })).not.toHaveAttribute('aria-current');
  });

  it('wandert mit den Pfeiltasten und öffnet mit Enter', async () => {
    const { router } = await build();
    const calls = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    screen.getByRole('button', { name: /Maronenröhrling/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /Steinpilz/ })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('button', { name: /Gallenröhrling/ })).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}{Enter}');

    expect(calls).toHaveBeenCalledWith(['/arten', 'semmelstoppelpilz']);
  });

  it('lässt andere Tasten in Ruhe', async () => {
    await build();

    const first = screen.getByRole('button', { name: /Maronenröhrling/ });
    first.focus();
    await userEvent.keyboard('{ArrowLeft}');

    expect(first).toHaveFocus();
  });
});
