import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionSourceComponent } from './section-source.component';
import { SpeciesEditorState } from './species-editor.state';
import { SECTION_SPECIES } from './section.testing';

const WITH_SOURCE = {
  ...SECTION_SPECIES,
  sources: [
    {
      scope: 'profile',
      title: '123pilzsuche.de',
      url: '123pilzsuche.de/daten/details/Steinpilz.htm',
      checkedOn: '2026-09-10',
    },
  ],
};

function routeFor(index: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', index });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(index = '0'): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionSourceComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor(index)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(WITH_SOURCE);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('SectionSourceComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
  });

  it('nennt Art, Titel, Adresse und Prüftag', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Quelle' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Profil' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Titel')).toHaveValue('123pilzsuche.de');
    expect(screen.getByLabelText('Adresse')).toHaveValue('123pilzsuche.de/daten/details/Steinpilz.htm');
    await noViolations(container);
  });

  it('schreibt die geänderte Quelle an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Quelle' });

    await userEvent.click(screen.getByRole('tab', { name: 'Weiterführend' }));
    await userEvent.clear(screen.getByLabelText('Titel'));
    await userEvent.type(screen.getByLabelText('Titel'), 'Wikipedia');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    const body = call.request.body as { sources: { scope: string; title: string }[] };
    expect(body.sources).toEqual([
      {
        scope: 'further',
        title: 'Wikipedia',
        url: '123pilzsuche.de/daten/details/Steinpilz.htm',
        checkedOn: '2026-09-10',
      },
    ]);
  });

  it('hängt eine weitere Quelle an', async () => {
    const { http } = await build('1');
    await screen.findByRole('heading', { name: 'Quelle' });

    await userEvent.type(screen.getByLabelText('Titel'), 'Wikipedia');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect((call.request.body as { sources: unknown[] }).sources).toHaveLength(2);
  });

  it('nimmt die Quelle heraus', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Quelle' });

    await userEvent.click(screen.getByRole('button', { name: 'Quelle entfernen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect((call.request.body as { sources: unknown[] }).sources).toEqual([]);
  });
});
