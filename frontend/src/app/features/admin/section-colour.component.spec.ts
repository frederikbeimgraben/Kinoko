import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { CatalogueState } from './catalogue.state';
import { SectionColourComponent } from './section-colour.component';
import { SpeciesEditorState } from './species-editor.state';
import { SECTION_SPECIES } from './section.testing';

const PALETTE = [
  { key: 'hell', hex: '#f4efe2' },
  { key: 'violett', hex: '#7a3b6a' },
];

function routeFor(): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', part: 'gills', index: '0' });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionColourComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  http.expectOne('/api/species/bundle').flush({ items: [], standardColours: PALETTE, facets: {} });
  return { container, http };
}

describe('SectionColourComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
    TestBed.inject(CatalogueState);
  });

  it('nennt Teil, Art des Werts und die Farben', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Lamellenfarbe' })).toBeInTheDocument();
    expect(screen.getAllByText('#E8C8CF')).toHaveLength(2);
    expect(screen.getByDisplayValue('rosa')).toBeInTheDocument();
    await noViolations(container);
  });

  it('legt eine Farbe an und schreibt sie an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Lamellenfarbe' });

    await userEvent.click(screen.getByRole('button', { name: '+ Farbe' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    const body = call.request.body as { colours: { part: string; colours: unknown[] }[] };
    expect(body.colours.find((one) => one.part === 'gills')?.colours).toHaveLength(2);
  });

  it('kürzt auf eine Farbe, sobald der Wert eine Farbe ist', async () => {
    await build();
    await screen.findByRole('heading', { name: 'Lamellenfarbe' });

    await userEvent.click(screen.getByRole('button', { name: '+ Farbe' }));
    await userEvent.click(screen.getByRole('tab', { name: 'eine Farbe' }));

    expect(screen.getAllByRole('button', { name: 'Entfernen' })).toHaveLength(1);
  });

  it('nimmt die Farbgruppe des Teils heraus', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Lamellenfarbe' });

    await userEvent.click(screen.getByRole('button', { name: 'Farbe entfernen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect((call.request.body as { colours: unknown[] }).colours).toEqual([]);
  });
});
