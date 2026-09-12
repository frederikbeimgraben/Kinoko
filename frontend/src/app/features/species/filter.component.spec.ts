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
  it('nennt an jeder Gruppe ihre Abdeckung, bevor jemand wählt', async () => {
    const { container } = await build();

    expect(screen.getByText('Speisewert')).toBeInTheDocument();
    // Zwei Gruppen sind vollständig beschrieben, darum steht die Zeile zweimal.
    expect(screen.getAllByText('306 von 306 beschrieben')).toHaveLength(2);
    // Hutform: 94 von 306 heißt, dass 212 Arten herausfallen, weil die Angabe
    // fehlt, und nicht weil sie nicht passen.
    expect(screen.getByText('94 von 306 beschrieben')).toBeInTheDocument();
    await noViolations(container);
  }, 30_000);

  it('lässt die Gruppen, die noch nicht wählbar sind, nicht öffnen', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByText('Farbe'));

    expect(screen.getByText('Kommt noch')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
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
