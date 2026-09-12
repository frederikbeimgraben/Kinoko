import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { SpeciesListComponent } from './species-list.component';
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
  return [...document.querySelectorAll('.speciesrow__name')].map((cell) => cell.textContent.trim());
}

describe('ArtenComponent', () => {
  it('zeigt jede Art mit lateinischem Namen und Tags', async () => {
    const { container } = await build();

    const row = screen.getByRole('button', { name: /Steinpilz/ });
    expect(within(row).getByText('Boletus edulis')).toBeInTheDocument();
    expect(within(row).getByText('Vorhersage')).toBeInTheDocument();
    expect(within(row).getByText('Geschützt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Speisemorchel/ })).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeichnet in der Liste keine Kurve mehr', async () => {
    const { container } = await build();

    // Seit D10 steht rechts das Titelbild. Auf 86 Pixeln liest die Kurve
    // ohnehin niemand ab; sie bleibt auf der Artseite.
    expect(container.querySelectorAll('.spark__all')).toHaveLength(0);
    expect(container.querySelectorAll('.speciesrow__image')).toHaveLength(0);
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
    const { refresh } = await build();

    expect(screen.getByText('5 Arten')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mit Vorhersage' }));
    refresh();

    // Ohne diese Zahl wirkte der Chip tot: die Liste steht nach Stufe, oben
    // bleiben dieselben Zeilen stehen.
    expect(screen.getByText('2 von 5 Arten')).toBeInTheDocument();
  });

  it('zeigt auch die Arten, die niemand sammelt', async () => {
    const { refresh } = await build();

    // Bis D9 stand der Gallenröhrling draußen und war nur über die Suche zu
    // finden. Wer einen Pilz gesehen hat und nachschlägt, weiß vorher nicht,
    // ob er sammelbar ist — das ist ja die Frage.
    expect(names()).toContain('Gallenröhrling');
    expect(screen.getByText('5 Arten')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sammelbar' }));
    refresh();

    expect(names()).not.toContain('Gallenröhrling');
    expect(screen.getByText('4 von 5 Arten')).toBeInTheDocument();
  });

  it('filtert nach der Stufe der Essbarkeit', async () => {
    const { refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'giftig' }));
    refresh();

    expect(names()).toEqual(['Gallenröhrling']);

    await userEvent.click(screen.getByRole('button', { name: 'tödlich giftig' }));
    refresh();

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Jede Stufe' }));
    refresh();

    expect(names()).toHaveLength(5);
  });

  it('findet über die Suche auch einen Giftpilz und zeigt seine Stufe rot', async () => {
    const { refresh } = await build();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Gallen');
    refresh();

    const row = screen.getByRole('button', { name: /Gallenröhrling/ });
    expect(within(row).getByText('Profil')).toBeInTheDocument();
    expect(within(row).getByText('giftig')).toBeInTheDocument();
  });

  it('setzt die Marken einer Zeile in fester Reihenfolge', async () => {
    await build();

    // Stufe, Schutz, Speisewert, Symbiosepartner, Jahreszeit — und nur, was
    // etwas sagt: „Essbar“ an jeder zweiten Zeile sagt nichts.
    const row = screen.getByRole('button', { name: /Steinpilz/ });
    const badges = [...row.querySelectorAll('.badge')].map((badge) => badge.textContent.trim());
    expect(badges).toEqual(['Vorhersage', 'Geschützt', 'Fichte']);
  });

  it('zeigt einen Leerzustand, wenn nichts passt', async () => {
    const { refresh } = await build();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Trüffel');
    refresh();

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
  });

  it('filtert über die Chips nach Stufe, Gruppe und Jahreszeit', async () => {
    const { refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Mit Vorhersage' }));
    refresh();
    expect(names()).toEqual(['Maronenröhrling', 'Steinpilz']);

    await userEvent.click(screen.getByRole('button', { name: 'Röhrlinge' }));
    refresh();
    // Der Gallenröhrling ist einer, auch wenn ihn niemand sammelt.
    expect(names()).toEqual(['Maronenröhrling', 'Steinpilz', 'Gallenröhrling']);

    await userEvent.click(screen.getByRole('button', { name: 'Herbst' }));
    refresh();
    expect(names()).toEqual(['Maronenröhrling', 'Steinpilz', 'Semmelstoppelpilz', 'Gallenröhrling']);

    await userEvent.click(screen.getByRole('button', { name: 'Alle' }));
    refresh();
    expect(names()).toHaveLength(5);
  });

  it('hebt die aktive Art der Karte hervor', async () => {
    const { state, refresh } = await build();

    state.select('maronenroehrling');
    refresh();

    const row = screen.getByRole('button', { name: /Maronenröhrling/ });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(within(row).getByText('Aktiv')).toBeInTheDocument();
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
