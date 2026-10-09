import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionSizeComponent } from './section-size.component';
import { SpeciesEditorStore } from './species-editor.store';
import { SECTION_SPECIES } from './section.testing';

function routeFor(
  params: Record<string, string>,
  query: Record<string, string> = {},
): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap(params);
  return {
    provide: ActivatedRoute,
    useValue: {
      paramMap: of(map),
      queryParamMap: of(convertToParamMap(query)),
      snapshot: { paramMap: map },
    },
  };
}

async function build(
  part = 'cap',
  query: Record<string, string> = {},
): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionSizeComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      routeFor({ slug: 'boletus-edulis', part }, query),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('SectionSizeComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
  });

  it('nennt das Teil im Kopf und füllt die Spanne mit Einheit', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Hut · Maß' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Breite' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('von')).toHaveValue('4');
    expect(screen.getByLabelText('bis')).toHaveValue('20');
    expect(screen.getByRole('tab', { name: 'cm' })).toHaveAttribute('aria-selected', 'true');
    await noViolations(container);
  });

  it('öffnet die Strecke, die die Zeile nennt', async () => {
    await build('cap', { dimension: 'height' });
    await screen.findByRole('heading', { name: 'Hut · Maß' });

    expect(screen.getByRole('tab', { name: 'Höhe' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('von')).toHaveValue('');
  });

  it('wechselt die Strecke und leert die Spanne, die es nicht gibt', async () => {
    await build();
    await screen.findByRole('heading', { name: 'Hut · Maß' });

    await userEvent.click(screen.getByRole('tab', { name: 'Höhe' }));

    expect(screen.getByLabelText('von')).toHaveValue('');
  });

  it('liest ein Komma als Dezimalzeichen und schreibt Spanne und Einheit an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Hut · Maß' });

    await userEvent.clear(screen.getByLabelText('bis'));
    await userEvent.type(screen.getByLabelText('bis'), '25,5');
    await userEvent.click(screen.getByRole('tab', { name: 'mm' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    const body = call.request.body as { measurements: { measurements: { high: number; unit: string }[] }[] };
    expect(body.measurements[0].measurements[0]).toMatchObject({ high: 25.5, unit: 'mm' });
  });

  it('schreibt nichts, wenn die untere Grenze über der oberen liegt', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Hut · Maß' });

    await userEvent.clear(screen.getByLabelText('bis'));
    await userEvent.type(screen.getByLabelText('bis'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    http.expectNone('/api/species/boletus-edulis');
  });

  it('nimmt das Maß heraus und lässt ein Teil ohne Maß weg', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Hut · Maß' });

    await userEvent.click(screen.getByRole('button', { name: 'Abmessung entfernen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect((call.request.body as { measurements: unknown[] }).measurements).toEqual([]);
  });

  it('zeigt bei einem unbekannten Teil den Zustand nicht gefunden', async () => {
    await build('hut');

    expect(await screen.findByText('Teil nicht gefunden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).not.toBeInTheDocument();
  });
});
