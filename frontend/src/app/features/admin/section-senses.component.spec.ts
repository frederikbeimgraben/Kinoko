import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionSensesComponent } from './section-senses.component';
import { SpeciesEditorStore } from './species-editor.store';
import { TermsStore } from './terms.store';
import { SECTION_SPECIES } from './section.testing';

const TERMS = {
  items: [
    { id: 't-1', kind: 'smell', group: null, slug: 'mushroomy', name: 'pilzig', position: 1 },
    { id: 't-2', kind: 'smell', group: null, slug: 'nutty', name: 'nussig', position: 2 },
    { id: 't-3', kind: 'taste', group: null, slug: 'mild', name: 'mild', position: 1 },
  ],
};

function routeFor(sense: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', sense });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(sense = 'geruch'): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionSensesComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor(sense)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  http.expectOne('/api/terms').flush(TERMS);
  return { container, http };
}

describe('SectionSensesComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
    TestBed.inject(TermsStore);
  });

  it('zeigt die Kategorien des Geruchs und den Satz dazu', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Geruch und Geschmack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pilzig' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'mild' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'nussig' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByDisplayValue('Frisch angenehm pilzig.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt die angehakten Kategorien und den Satz', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Geruch und Geschmack' });

    await userEvent.click(screen.getByRole('button', { name: 'nussig' }));
    await userEvent.click(screen.getByRole('button', { name: 'mild' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Geschmack' }), 'Mild.');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    const body = call.request.body as {
      terms: { term: { id: string } }[];
      smellText: string;
      tasteText: string;
    };
    expect(body.terms.map((one) => one.term.id)).toEqual(['t-1', 't-2', 't-3']);
    expect(body.smellText).toBe('Frisch angenehm pilzig.');
    expect(body.tasteText).toBe('Mild.');
  });
});
