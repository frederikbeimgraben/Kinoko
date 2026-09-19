import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SpeciesEditorComponent } from './species-editor.component';
import { SpeciesEditorState } from './species-editor.state';

const NOW = '2026-09-10T10:00:00+02:00';

const PROFILE = {
  id: 'art-eins',
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  genusName: 'Boletus',
  group: 'bolete',
  edibility: 'edible',
  protection: 'none',
  forecastEnabled: true,
  updatedAt: NOW,
  updatedByName: 'Frederik',
  description: 'Brauner Hut',
  edibilityNote: 'Geschmacksprobe',
  marketable: false,
  names: [],
  measurements: [
    {
      part: 'cap',
      measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }],
    },
  ],
  colours: [{ part: 'cap', mode: 'single', colours: [{ name: 'braun', hex: '#5a3d22' }] }],
  colourChanges: [],
  capFeatures: [],
  capMargins: [],
  stemFeatures: [],
  traits: [],
  sources: [{ scope: 'profile', title: '123pilzsuche.de', url: 'https://x', checkedOn: '2026-09-10' }],
  seasons: [],
  terms: [],
  lookalikes: [
    {
      slug: 'tylopilus-felleus',
      name: 'Gallenröhrling',
      scientificName: 'Tylopilus felleus',
      edibility: 'inedible',
      capColours: [],
      difference: 'bitter',
    },
  ],
};

function routeFor(slug: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const params = convertToParamMap({ slug });
  return { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } };
}

async function build(
  profile: Record<string, unknown> = PROFILE,
  counts = { records: 1284, finds: 12, photos: 3 },
): Promise<{
  container: Element;
  http: HttpTestingController;
}> {
  TestBed.resetTestingModule();
  const { container } = await render(SpeciesEditorComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      routeFor('boletus-edulis'),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(profile);
  http.expectOne('/api/species/boletus-edulis/counts').flush(counts);
  return { container, http };
}

describe('SpeciesEditorComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
  });

  it('nennt Kopf, Zahlen, Merkmale und Quelle', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Steinpilz bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('1 284')).toBeInTheDocument();
    expect(screen.getByText('4 bis 20 cm, braun')).toBeInTheDocument();
    expect(screen.getByText(/geändert von Frederik/)).toBeInTheDocument();
    await noViolations(container);
  });

  it('schaltet die Vorhersage über den Schalter', async () => {
    const { http } = await build();
    await screen.findByRole('switch', { name: 'Vorhersage' });

    await userEvent.click(screen.getByRole('switch', { name: 'Vorhersage' }));

    const call = http.expectOne('/api/species/boletus-edulis/forecast');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual({ enabled: false });
    call.flush({ ...PROFILE, forecastEnabled: false });
  });

  it('führt die Quellen und legt eine weitere an', async () => {
    await build();
    const router = TestBed.inject(Router);
    const paths: string[] = [];
    vi.spyOn(router, 'navigate').mockImplementation((parts: readonly unknown[]) => {
      paths.push(parts.join('/'));
      return Promise.resolve(true);
    });
    await screen.findByRole('button', { name: /123pilzsuche\.de/ });

    await userEvent.click(screen.getByRole('button', { name: /123pilzsuche\.de/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Quelle hinzufügen' }));

    expect(paths).toEqual([
      '/verwaltung/arten/boletus-edulis/quelle/0',
      '/verwaltung/arten/boletus-edulis/quelle/1',
    ]);
  });

  it('nimmt ein Teil in die Merkmale auf', async () => {
    await build();
    await screen.findByRole('button', { name: 'Teil hinzufügen' });

    await userEvent.click(screen.getByRole('button', { name: 'Teil hinzufügen' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stiel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(screen.getByText('Stiel')).toBeInTheDocument();
  });

  it('fragt vor dem Löschen nach und löscht dann', async () => {
    const { http } = await build(PROFILE, { records: 12, finds: 0, photos: 1 });
    await screen.findByRole('button', { name: 'Art löschen' });

    await userEvent.click(screen.getByRole('button', { name: 'Art löschen' }));
    expect(screen.getByText('Steinpilz löschen?')).toBeInTheDocument();
    expect(screen.getByText('Karte vorhanden')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(http.expectOne('/api/species/boletus-edulis').request.method).toBe('DELETE');
  });

  it('sperrt das Löschen, solange die Art Funde trägt', async () => {
    await build();
    await screen.findByRole('button', { name: 'Art löschen' });

    await userEvent.click(screen.getByRole('button', { name: 'Art löschen' }));

    expect(screen.getByText('12 Funde · Karte vorhanden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeDisabled();
  });

  it('führt von einer Verwechslung auf ihre Unterseite', async () => {
    await build();
    const router = TestBed.inject(Router);
    const paths: string[] = [];
    vi.spyOn(router, 'navigate').mockImplementation((parts: readonly unknown[]) => {
      paths.push(parts.join('/'));
      return Promise.resolve(true);
    });
    await screen.findByRole('button', { name: /Gallenröhrling/ });

    await userEvent.click(screen.getByRole('button', { name: /Gallenröhrling/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Verwechslung hinzufügen' }));

    expect(paths).toEqual([
      '/verwaltung/arten/boletus-edulis/verwechslung/0',
      '/verwaltung/arten/boletus-edulis/verwechslung/1',
    ]);
  });

  it('führt von einem Text nirgends hin und von einem Merkmal auf sein Teil', async () => {
    await build();
    const router = TestBed.inject(Router);
    const paths: string[] = [];
    vi.spyOn(router, 'navigate').mockImplementation((parts: readonly unknown[]) => {
      paths.push(parts.join('/'));
      return Promise.resolve(true);
    });
    await screen.findByRole('button', { name: /Hut/ });

    await userEvent.click(screen.getByRole('button', { name: /Hut/ }));
    await userEvent.click(screen.getByText('Kurzbeschreibung'));

    expect(paths).toEqual(['/verwaltung/arten/boletus-edulis/teil/cap']);
  });
});
