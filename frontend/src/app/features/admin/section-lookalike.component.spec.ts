import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SpeciesState } from '../species/species.state';
import { SectionLookalikeComponent } from './section-lookalike.component';
import { SpeciesEditorState } from './species-editor.state';
import { SECTION_SPECIES } from './section.testing';

const BUNDLE = {
  items: [
    {
      id: 'art-zwei',
      slug: 'tylopilus-felleus',
      name: 'Gallenröhrling',
      scientificName: 'Tylopilus felleus',
      group: 'bolete',
      edibility: 'inedible',
      protection: 'none',
      forecastEnabled: false,
    },
  ],
  standardColours: [],
  facets: {},
};

const WITH_LOOKALIKE = {
  ...SECTION_SPECIES,
  lookalikes: [
    {
      slug: 'tylopilus-felleus',
      name: 'Gallenröhrling',
      scientificName: 'Tylopilus felleus',
      edibility: 'inedible',
      capColours: [],
      difference: 'Röhren rosa, Netz grob, bitter',
    },
  ],
};

function routeFor(index: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', index });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(
  profile: Record<string, unknown> = WITH_LOOKALIKE,
  index = '0',
): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionLookalikeComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor(index)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(profile);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(BUNDLE);
  });
  const catalogue = TestBed.inject(SpeciesState);
  await vi.waitFor(() => {
    expect(catalogue.species()).toHaveLength(BUNDLE.items.length);
  });
  return { container, http };
}

describe('SectionLookalikeComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
  });

  it('nennt die andere Art und den Unterschied', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Verwechslung' })).toBeInTheDocument();
    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    expect(screen.getByLabelText('Unterscheidung')).toHaveValue('Röhren rosa, Netz grob, bitter');
    await noViolations(container);
  });

  it('schreibt den Unterschied an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Verwechslung' });

    await userEvent.clear(screen.getByLabelText('Unterscheidung'));
    await userEvent.type(screen.getByLabelText('Unterscheidung'), 'bitter');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect((call.request.body as { lookalikes: unknown[] }).lookalikes).toEqual([
      { slug: 'tylopilus-felleus', difference: 'bitter' },
    ]);
  });

  it('nimmt die Verwechslung heraus', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Verwechslung' });

    await userEvent.click(screen.getByRole('button', { name: 'Verwechslung entfernen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect((call.request.body as { lookalikes: unknown[] }).lookalikes).toEqual([]);
  });

  it('wählt die andere Art und hängt eine neue Verwechslung an', async () => {
    const { http } = await build(WITH_LOOKALIKE, '1');
    await screen.findByRole('heading', { name: 'Verwechslung' });

    await userEvent.click(screen.getByRole('button', { name: 'Art' }));
    await userEvent.click(screen.getByRole('button', { name: /Gallenröhrling/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(
      (call.request.body as { lookalikes: { slug: string }[] }).lookalikes.map((one) => one.slug),
    ).toEqual(['tylopilus-felleus', 'tylopilus-felleus']);
  });

  it('kehrt aus der Artwahl ohne Wahl zurück', async () => {
    await build(WITH_LOOKALIKE, '1');
    await screen.findByRole('heading', { name: 'Verwechslung' });

    await userEvent.click(screen.getByRole('button', { name: 'Art' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.getByRole('button', { name: 'Art' })).toBeInTheDocument();
  });

  it('schreibt nichts, solange keine Art gewählt ist', async () => {
    const { http } = await build(WITH_LOOKALIKE, '1');
    await screen.findByRole('heading', { name: 'Verwechslung' });

    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    http.expectNone('/api/species/boletus-edulis');
  });
});
