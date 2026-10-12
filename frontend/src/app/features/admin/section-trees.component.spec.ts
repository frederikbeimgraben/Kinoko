import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionTreesComponent } from './section-trees.component';
import { SpeciesEditorStore } from './species-editor.store';
import { TermsStore } from './terms.store';
import { SECTION_SPECIES } from './section.testing';

const TERMS = {
  items: [
    { id: 'b-1', kind: 'tree', group: null, slug: 'beech', name: 'Buche', position: 1 },
    { id: 'b-2', kind: 'tree', group: null, slug: 'oak', name: 'Eiche', position: 2 },
    { id: 'b-3', kind: 'tree', group: null, slug: 'spruce', name: 'Fichte', position: 3 },
    { id: 't-1', kind: 'smell', group: null, slug: 'mushroomy', name: 'pilzig', position: 1 },
  ],
};

const WITH_TREES = {
  ...SECTION_SPECIES,
  terms: [
    ...(SECTION_SPECIES['terms'] as unknown[]),
    { term: { id: 'b-1', slug: 'beech', name: 'Buche', kind: 'tree' }, fromExperience: true },
    { term: { id: 'b-9', slug: 'gone', name: 'Alt', kind: 'tree' }, fromExperience: false },
  ],
};

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const map = convertToParamMap({ slug: 'boletus-edulis' });
  const { container } = await render(SectionTreesComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(WITH_TREES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  http.expectOne('/api/terms').flush(TERMS);
  return { container, http };
}

describe('SectionTreesComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
    TestBed.inject(TermsStore);
  });

  it('zeigt die Bäume und die aus eigener Erfahrung', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Bäume' })).toBeInTheDocument();
    const chosen = screen.getByRole('group', { name: 'Partnerbäume' });
    expect(within(chosen).getByRole('button', { name: 'Buche' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chosen).getByRole('button', { name: 'Eiche' })).toHaveAttribute('aria-pressed', 'false');
    const experience = screen.getByRole('group', { name: 'Aus eigener Erfahrung' });
    expect(within(experience).getByRole('button', { name: 'Buche' })).toHaveAttribute('aria-pressed', 'true');
    await noViolations(container);
  });

  it('schreibt die Bäume mit ihrer Herkunft und behält die anderen Kategorien', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Bäume' });

    const chosen = screen.getByRole('group', { name: 'Partnerbäume' });
    await userEvent.click(within(chosen).getByRole('button', { name: 'Fichte' }));
    const experience = screen.getByRole('group', { name: 'Aus eigener Erfahrung' });
    await userEvent.click(within(experience).getByRole('button', { name: 'Fichte' }));
    await userEvent.click(within(experience).getByRole('button', { name: 'Buche' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as {
      terms: { term: { id: string; kind: string; name: string }; fromExperience: boolean }[];
    };
    expect(body.terms.map((one) => [one.term.id, one.term.name, one.fromExperience])).toEqual([
      ['t-1', 'pilzig', false],
      ['b-1', 'Buche', false],
      ['b-9', 'Alt', false],
      ['b-3', 'Fichte', true],
    ]);
  });

  it('nimmt einem abgewählten Baum die Erfahrung', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Bäume' });

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Partnerbäume' })).getByRole('button', { name: 'Buche' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as {
      terms: { term: { id: string } }[];
    };
    expect(body.terms.map((one) => one.term.id)).toEqual(['t-1', 'b-9']);
  });
});
