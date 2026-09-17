import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionSeasonComponent } from './section-season.component';
import { SpeciesEditorState } from './species-editor.state';
import { SECTION_SPECIES } from './section.testing';

function routeFor(): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis' });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionSeasonComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('SectionSeasonComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
  });

  it('nennt die Monate des Zeitraums', async () => {
    const { container } = await build();

    expect(await screen.findByText('Juni')).toBeInTheDocument();
    expect(screen.getByText('Oktober')).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt den gezogenen Zeitraum an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByText('Juni');

    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual(expect.objectContaining({ periodStartMonth: 6, periodEndMonth: 10 }));
  });
});
