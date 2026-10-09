import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionPartComponent } from './section-part.component';
import { SpeciesEditorStore } from './species-editor.store';
import { SECTION_SPECIES } from './section.testing';

function routeFor(part: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', part });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(
  part = 'cap',
  more: Record<string, unknown> = {},
): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionPartComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor(part)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush({ ...SECTION_SPECIES, ...more });
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('SectionPartComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
  });

  it('nennt das Teil im Kopf und je Wert eine Zeile', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Hut' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Breite/ })).toHaveTextContent('4 – 20cm');
    await noViolations(container);
  });

  it('zeigt den Text des Teils als Beschreibung und schreibt ihn in das Merkmal', async () => {
    const { http } = await build('cap', { traits: [{ key: 'cap', text: 'Halbkugelig.' }] });
    await screen.findByRole('heading', { name: 'Hut' });

    expect(screen.getByRole('textbox', { name: 'Beschreibung' })).toHaveValue('Halbkugelig.');
    await userEvent.type(screen.getByRole('textbox', { name: 'Beschreibung' }), ' Später flach.');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as {
      traits: { key: string; text: string }[];
      partNotes: unknown[];
    };
    expect(body.traits).toEqual([{ key: 'cap', text: 'Halbkugelig. Später flach.' }]);
    expect(body.partNotes).toEqual([]);
  });

  it('zeigt bei einem deutschen Teilnamen den Zustand nicht gefunden', async () => {
    await build('hut');

    expect(await screen.findByText('Teil nicht gefunden')).toBeInTheDocument();
  });

  it('bleibt ohne Werte leer, führt aber die Zeilen zum Anlegen', async () => {
    await build('spore');

    expect(await screen.findByRole('heading', { name: 'Sporen' })).toBeInTheDocument();
    expect(screen.queryByText('Breite')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maß hinzufügen' })).toBeInTheDocument();
  });

  it('führt jede wachsende Liste mit einer Zeile zum Anlegen', async () => {
    await build('gills');

    expect(await screen.findByRole('heading', { name: 'Lamellen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Farbe hinzufügen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verfärbung hinzufügen' })).toBeInTheDocument();
  });

  it('führt von jeder Zeile und jeder Anlegezeile auf ihre Unterseite', async () => {
    await build('gills');
    const router = TestBed.inject(Router);
    const paths: string[] = [];
    vi.spyOn(router, 'navigate').mockImplementation((parts: readonly unknown[]) => {
      paths.push(parts.join('/'));
      return Promise.resolve(true);
    });
    await screen.findByRole('heading', { name: 'Lamellen' });

    await userEvent.click(screen.getByRole('button', { name: /Lamellenfarbe/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Farbe hinzufügen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Verfärbung hinzufügen' }));

    expect(paths).toEqual([
      '/verwaltung/arten/boletus-edulis/farbe/gills/0',
      '/verwaltung/arten/boletus-edulis/farbe/gills/1',
      '/verwaltung/arten/boletus-edulis/verfaerbung/gills/0',
    ]);
  });

  it('nimmt das Teil mit seinen Werten heraus', async () => {
    const { http } = await build('gills');
    await screen.findByRole('heading', { name: 'Lamellen' });

    await userEvent.click(screen.getByRole('button', { name: 'Teil entfernen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect((call.request.body as { colours: unknown[] }).colours).toEqual([]);
  });
});
