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
import { SpeciesEditorState } from './species-editor.state';
import { SECTION_SPECIES } from './section.testing';

function routeFor(params: Record<string, string>): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap(params);
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionSizeComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      routeFor({ slug: 'boletus-edulis', part: 'cap' }),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('SectionSizeComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
  });

  it('nennt Teil und Strecke im Kopf und füllt die Spanne', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Hutbreite' })).toBeInTheDocument();
    expect(screen.getByLabelText('von')).toHaveValue(4);
    expect(screen.getByLabelText('bis')).toHaveValue(20);
    await noViolations(container);
  });

  it('wechselt die Strecke und leert die Spanne, die es nicht gibt', async () => {
    await build();
    await screen.findByRole('heading', { name: 'Hutbreite' });

    await userEvent.click(screen.getByRole('tab', { name: 'Höhe' }));

    expect(screen.getByRole('heading', { name: 'Huthöhe' })).toBeInTheDocument();
    expect(screen.getByLabelText('von')).toHaveValue(null);
  });

  it('schreibt die Spanne an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Hutbreite' });

    await userEvent.clear(screen.getByLabelText('bis'));
    await userEvent.type(screen.getByLabelText('bis'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    const body = call.request.body as { measurements: { measurements: { high: number }[] }[] };
    expect(body.measurements[0].measurements[0].high).toBe(25);
  });

  it('nimmt das Maß heraus und lässt ein Teil ohne Maß weg', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Hutbreite' });

    await userEvent.click(screen.getByRole('button', { name: 'Maß entfernen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect((call.request.body as { measurements: unknown[] }).measurements).toEqual([]);
  });
});
