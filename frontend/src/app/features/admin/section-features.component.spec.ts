import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionFeaturesComponent } from './section-features.component';
import { inPhase, phaseEntries } from './section-features.rows';
import { SpeciesEditorStore } from './species-editor.store';
import { SECTION_SPECIES } from './section.testing';

const WITH_FEATURES = {
  ...SECTION_SPECIES,
  capShapeYoung: 'hemispherical',
  capShapeOld: null,
  capFeatures: [{ feature: 'umbonate', phase: 'young' }],
  capMargins: [{ margin: 'inrolled', phase: 'old' }],
  stemFeatures: [{ feature: 'netted', phase: 'old' }],
};

async function build(part: string): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const map = convertToParamMap({ slug: 'boletus-edulis', part });
  const { container } = await render(SectionFeaturesComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(WITH_FEATURES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('phaseEntries', () => {
  it('ordnet erst jung, dann alt, je in der Reihenfolge der Werte', () => {
    expect(phaseEntries(['a', 'b', 'c'], ['c', 'a'], ['b'])).toEqual([
      { value: 'a', phase: 'young' },
      { value: 'c', phase: 'young' },
      { value: 'b', phase: 'old' },
    ]);
    expect(inPhase([{ value: 'a', phase: 'old' }], 'young')).toEqual([]);
  });
});

describe('SectionFeaturesComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
  });

  it('zeigt Form, Merkmale und Rand des Huts', async () => {
    const { container } = await build('cap');

    expect(await screen.findByRole('heading', { name: 'Hut: Form und Merkmale' })).toBeInTheDocument();
    const shape = screen.getByRole('group', { name: 'Form jung' });
    expect(within(shape).getByRole('button', { name: 'halbkugelig' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const features = screen.getByRole('group', { name: 'Merkmale jung' });
    expect(within(features).getByRole('button', { name: 'gebuckelt' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const margin = screen.getByRole('group', { name: 'Hutrand alt' });
    expect(within(margin).getByRole('button', { name: 'eingerollt' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await noViolations(container);
  });

  it('schreibt Form, Merkmale und Rand des Huts', async () => {
    const { http } = await build('cap');
    await screen.findByRole('heading', { name: 'Hut: Form und Merkmale' });

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Form alt' })).getByRole('button', { name: 'flach' }),
    );
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Merkmale alt' })).getByRole('button', { name: 'gezont' }),
    );
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Hutrand alt' })).getByRole('button', { name: 'eingerollt' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(http.expectOne('/api/species/boletus-edulis').request.body).toMatchObject({
      capShapeYoung: 'hemispherical',
      capShapeOld: 'flat',
      capFeatures: [
        { feature: 'umbonate', phase: 'young' },
        { feature: 'zoned', phase: 'old' },
      ],
      capMargins: [],
      stemFeatures: [{ feature: 'netted', phase: 'old' }],
    });
  });

  it('zeigt und schreibt beim Stiel nur seine Merkmale', async () => {
    const { http } = await build('stem');
    await screen.findByRole('heading', { name: 'Stiel: Form und Merkmale' });

    expect(screen.queryByRole('group', { name: 'Form jung' })).not.toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Merkmale jung' })).getByRole('button', { name: 'Knolle' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(http.expectOne('/api/species/boletus-edulis').request.body).toMatchObject({
      capFeatures: [{ feature: 'umbonate', phase: 'young' }],
      stemFeatures: [
        { feature: 'bulb', phase: 'young' },
        { feature: 'netted', phase: 'old' },
      ],
    });
  });
});
