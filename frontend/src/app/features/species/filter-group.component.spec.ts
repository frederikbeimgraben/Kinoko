import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { FACETS } from '../../testing/facets-fixture';
import { noViolations } from '../../testing/axe';
import { SpeciesFilterGroupComponent } from './filter-group.component';
import { SpeciesFilterState } from './filter.state';

async function build(gruppe = 'hutform'): Promise<{ container: Element; refresh: () => void }> {
  const { container, detectChanges } = await render(SpeciesFilterGroupComponent, {
    inputs: { gruppe },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const http = TestBed.inject(HttpTestingController);
  if (gruppe !== 'gibtesnicht') http.expectOne('/api/arten/merkmale').flush(FACETS);
  detectChanges();
  return { container, refresh: detectChanges };
}

describe('SpeciesFilterGroupComponent', () => {
  it('nennt an jedem Wert seine Zahl', async () => {
    const { container } = await build();

    expect(screen.getByText('gewölbt')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    // Ein Wert, den keine Art trägt, steht mit Null da statt zu fehlen.
    expect(screen.getByText('0')).toBeInTheDocument();
    await noViolations(container);
  }, 30_000);

  it('sagt, wie viele Arten die Lücke kostet, und lässt sie behalten', async () => {
    const { refresh } = await build();
    const filter = TestBed.inject(SpeciesFilterState);

    expect(
      screen.getByText(
        '212 der 306 Arten tragen zu diesem Merkmal keine Angabe. Sie fallen aus dem Ergebnis, wenn du hier wählst.',
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Arten ohne Angabe behalten'));
    refresh();

    expect(filter.keeps('hutform')).toBe(true);
  });

  it('nimmt mehrere Werte einer Gruppe an und wieder zurück', async () => {
    const { refresh } = await build();
    const filter = TestBed.inject(SpeciesFilterState);

    await userEvent.click(screen.getByText('gewölbt'));
    await userEvent.click(screen.getByText('flach'));
    refresh();
    expect(filter.chosenIn('hutform')).toEqual(new Set(['gewoelbt', 'flach']));

    await userEvent.click(screen.getByText('gewölbt'));
    refresh();

    expect(filter.chosenIn('hutform')).toEqual(new Set(['flach']));
  });

  it('teilt eine Gruppe in ihre Teile', async () => {
    await build('fruchtschicht');

    expect(screen.getByRole('heading', { name: 'Form' })).toBeInTheDocument();
    expect(screen.getByText('Lamellen')).toBeInTheDocument();
  });

  it('meldet eine Gruppe, die es nicht gibt', async () => {
    await build('gibtesnicht');

    expect(screen.getByText('Kein Filter gesetzt.')).toBeInTheDocument();
  });
});
