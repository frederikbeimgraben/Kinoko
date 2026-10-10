import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { HistoryService } from '../../core/navigation/history.service';
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

async function buildWithFixture(): Promise<{ fixture: ComponentFixture<SectionPartComponent> }> {
  TestBed.resetTestingModule();
  const { fixture } = await render(SectionPartComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor('cap')],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { fixture };
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

  it('zeigt beim Ring die Form und schreibt die gewählte Form', async () => {
    const { http } = await build('ring', { ringShape: 'pendant' });
    await screen.findByRole('heading', { name: 'Ring' });

    const shapes = screen.getByRole('group', { name: 'Form' });
    expect(screen.getByRole('button', { name: 'hängend' })).toHaveAttribute('aria-pressed', 'true');
    expect(shapes.querySelectorAll('app-filter-chip')).toHaveLength(6);

    await userEvent.click(screen.getByRole('button', { name: 'doppelt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as { ringShape: string | null };
    expect(body.ringShape).toBe('double');
  });

  it('löscht die Form, wenn die gewählte Form wieder abgewählt ist', async () => {
    const { http } = await build('ring', { ringShape: 'zone' });
    await screen.findByRole('heading', { name: 'Ring' });

    await userEvent.click(screen.getByRole('button', { name: 'Ringzone' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as { ringShape: string | null };
    expect(body.ringShape).toBeNull();
  });

  it('zeigt bei anderen Teilen keine Form', async () => {
    await build('cap', { ringShape: 'pendant' });
    await screen.findByRole('heading', { name: 'Hut' });

    expect(screen.queryByRole('group', { name: 'Form' })).toBeNull();
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

  it('behält den getippten Text, während eine Unterseite offen ist', async () => {
    const { fixture } = await buildWithFixture();
    await screen.findByRole('heading', { name: 'Hut' });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await userEvent.type(screen.getByRole('textbox', { name: 'Kommentar' }), 'Noch offen');
    await userEvent.click(screen.getByRole('button', { name: /Breite/ }));
    fixture.destroy();
    const again = TestBed.createComponent(SectionPartComponent);
    again.detectChanges();

    const comment = (again.nativeElement as HTMLElement).querySelectorAll('textarea')[1];
    expect(comment.value).toBe('Noch offen');
  });

  it('geht zurück auf die Seite davor und verwirft dabei den Entwurf', async () => {
    await build();
    await screen.findByRole('heading', { name: 'Hut' });
    const back = vi.spyOn(TestBed.inject(HistoryService), 'back').mockReturnValue();

    await userEvent.type(screen.getByRole('textbox', { name: 'Kommentar' }), 'Weg damit');
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(back).toHaveBeenCalledWith(['/verwaltung/arten', 'boletus-edulis']);
    expect(TestBed.inject(SpeciesEditorStore).drafts()).toEqual({});
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
