import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionBasicsComponent } from './section-basics.component';
import { SpeciesEditorStore } from './species-editor.store';
import { SECTION_SPECIES } from './section.testing';

const GENERA = {
  items: [
    { id: 'g-1', slug: 'boletus', name: 'Boletus', rank: 'genus' },
    { id: 'g-2', slug: 'suillus', name: 'Suillus', rank: 'genus' },
  ],
};

const WITH_BASICS = {
  ...SECTION_SPECIES,
  taxonId: 'g-1',
  names: [
    { name: 'Herrenpilz', kind: 'common' },
    { name: 'Boletus bulbosus', kind: 'synonym' },
  ],
  marketable: true,
  redList: 'vulnerable',
  frequency: null,
  protectionNote: null,
  descriptionDraft: false,
};

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const map = convertToParamMap({ slug: 'boletus-edulis' });
  const { container } = await render(SectionBasicsComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(WITH_BASICS);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  http.expectOne('/api/taxa?rank=genus').flush(GENERA);
  return { container, http };
}

describe('SectionBasicsComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
  });

  it('zeigt Name, weitere Namen, Einordnung und Status', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Name und Einordnung' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Steinpilz');
    expect(screen.getByLabelText('Lateinischer Name')).toHaveValue('Boletus edulis');
    expect(screen.getByLabelText('Weitere Namen')).toHaveValue('Herrenpilz');
    expect(screen.getByLabelText('Synonyme')).toHaveValue('Boletus bulbosus');
    expect(screen.getByText('Boletus')).toBeInTheDocument();
    expect(screen.getByLabelText('Handel erlaubt')).toBeChecked();
    expect(screen.getByLabelText('Beschreibung ist ein Entwurf')).not.toBeChecked();
    expect(screen.getByText('gefährdet').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('häufig').closest('button')).toHaveAttribute('aria-pressed', 'false');
    await noViolations(container);
  });

  it('schreibt Namen und Schutz an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Name und Einordnung' });

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Fichtenpilz');
    await userEvent.type(screen.getByLabelText('Synonyme'), ', B. pinophilus');
    await userEvent.click(screen.getByText('Schutz'));
    await userEvent.click(within(await screen.findByRole('dialog')).getByText(/Eigenbedarf/));
    await userEvent.type(screen.getByLabelText('Hinweis zum Schutz'), '1 kg');
    await userEvent.click(screen.getByText('Übernehmen'));

    expect(http.expectOne('/api/species/boletus-edulis').request.body).toMatchObject({
      name: 'Fichtenpilz',
      scientificName: 'Boletus edulis',
      names: [
        { name: 'Herrenpilz', kind: 'common' },
        { name: 'Boletus bulbosus', kind: 'synonym' },
        { name: 'B. pinophilus', kind: 'synonym' },
      ],
      protection: 'personal_use',
      protectionNote: '1 kg',
    });
  });

  it('schreibt Gruppe, Speisewert und Status an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Name und Einordnung' });

    // The group sheet holds many rows; text queries keep the test fast.
    await userEvent.click(screen.getByText('Gattungsgruppe'));
    await userEvent.click(within(await screen.findByRole('dialog')).getByText(/^Täubling/));
    await userEvent.click(screen.getByText('gefährdet'));
    await userEvent.click(screen.getByText('häufig'));
    await userEvent.click(screen.getByText('giftig'));
    await userEvent.click(screen.getByLabelText('Handel erlaubt'));
    await userEvent.click(screen.getByLabelText('Beschreibung ist ein Entwurf'));
    await userEvent.click(screen.getByText('Übernehmen'));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toMatchObject({
      group: 'brittlegill',
      edibility: 'poisonous',
      redList: null,
      frequency: 'common',
      marketable: false,
      descriptionDraft: true,
    });
  });

  it('wählt eine andere Gattung und nimmt sie wieder heraus', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Name und Einordnung' });

    await userEvent.click(screen.getByRole('button', { name: /Gattung\s*Boletus/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByText('Suillus'));
    expect(screen.getByRole('button', { name: /Gattung\s*Suillus/ })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Übernehmen'));
    expect(http.expectOne('/api/species/boletus-edulis').request.body).toMatchObject({ taxonId: 'g-2' });
  });

  it('schreibt eine Art ohne Gattung', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Name und Einordnung' });

    await userEvent.click(screen.getByRole('button', { name: /Gattung\s*Boletus/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByText('–'));
    await userEvent.click(screen.getByText('Übernehmen'));
    expect(http.expectOne('/api/species/boletus-edulis').request.body).toMatchObject({ taxonId: null });
  });

  it('schreibt nichts ohne Namen', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Name und Einordnung' });

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByText('Übernehmen'));

    http.expectNone('/api/species/boletus-edulis');
  });
});
