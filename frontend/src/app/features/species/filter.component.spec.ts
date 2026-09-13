import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { FACETS } from '../../testing/facets-fixture';
import { noViolations } from '../../testing/axe';
import { SpeciesFilterComponent } from './filter.component';
import { SpeciesFilterState } from './filter.state';

async function build(): Promise<{ container: Element; router: Router; refresh: () => void }> {
  const { container, detectChanges } = await render(SpeciesFilterComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/arten/merkmale').flush(FACETS);
  detectChanges();
  return { container, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('SpeciesFilterComponent', () => {
  it('nennt die Abdeckung nur an Gruppen mit Lücke', async () => {
    const { container } = await build();

    expect(screen.getByText('Speisewert')).toBeInTheDocument();
    // Vollständig beschrieben heißt: nichts zu sagen. Die Zeile wäre auf
    // jeder Gruppe dieselbe.
    expect(screen.queryByText('306 von 306 beschrieben')).toBeNull();
    // Hutform: 94 von 306 heißt, dass 212 Arten herausfallen, weil die Angabe
    // fehlt, und nicht weil sie nicht passen.
    expect(screen.getByText('94 von 306 beschrieben')).toBeInTheDocument();
    await noViolations(container);
  }, 30_000);

  it('zeigt Gruppen, die noch nicht wählbar sind, gar nicht', async () => {
    await build();

    // Eine Zeile, die sich nicht öffnen lässt, ist eine kaputte Zeile.
    expect(screen.queryByText('Farbe')).toBeNull();
    expect(screen.queryByText('Kommt noch')).toBeNull();
  });

  it('stellt die Gruppen in Karten nach dem Mockup auf', async () => {
    const { container } = await build();

    const names = [...container.querySelectorAll('.group__name')].map((node) => node.textContent.trim());
    expect(names).toEqual(['Speisewert', 'Fruchtschicht', 'Hutform']);
    expect(container.querySelectorAll('app-card')).toHaveLength(1);
  });

  it('führt in eine Gruppe', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByText('Speisewert'));

    expect(navigate).toHaveBeenCalledWith(['/arten/filter', 'speisewert']);
  });

  it('zeigt Zurücksetzen erst, wenn etwas gesetzt ist, und räumt dann auf', async () => {
    const { refresh } = await build();
    const filter = TestBed.inject(SpeciesFilterState);
    expect(screen.queryByText('Zurücksetzen')).toBeNull();

    filter.toggle('speisewert', 'essbar');
    refresh();
    await userEvent.click(screen.getByText('Zurücksetzen'));
    refresh();

    expect(filter.any()).toBe(false);
  });
});
