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

const WITH_BASICS = {
  ...SECTION_SPECIES,
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
    expect(screen.getByRole('checkbox', { name: 'Handel erlaubt' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Beschreibung ist ein Entwurf' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'gefährdet' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'häufig' })).toHaveAttribute('aria-pressed', 'false');
    await noViolations(container);
  });

  it('schreibt alle Felder der Seite an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Name und Einordnung' });

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Fichtensteinpilz');
    await userEvent.type(screen.getByLabelText('Synonyme'), ', Boletus edulis var. edulis');
    await userEvent.click(screen.getByRole('button', { name: /Gattungsgruppe/ }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /Täubling/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Schutz/ }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /Eigenbedarf/ }),
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Hinweis zum Schutz' }), 'Nur 1 kg am Tag.');
    await userEvent.click(screen.getByRole('button', { name: 'gefährdet' }));
    await userEvent.click(screen.getByRole('button', { name: 'häufig' }));
    await userEvent.click(screen.getByRole('tab', { name: 'giftig' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Handel erlaubt' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Beschreibung ist ein Entwurf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toMatchObject({
      name: 'Fichtensteinpilz',
      scientificName: 'Boletus edulis',
      names: [
        { name: 'Herrenpilz', kind: 'common' },
        { name: 'Boletus bulbosus', kind: 'synonym' },
        { name: 'Boletus edulis var. edulis', kind: 'synonym' },
      ],
      group: 'brittlegill',
      edibility: 'poisonous',
      protection: 'personal_use',
      protectionNote: 'Nur 1 kg am Tag.',
      redList: null,
      frequency: 'common',
      marketable: false,
      descriptionDraft: true,
    });
  });

  it('schreibt nichts ohne Namen', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Name und Einordnung' });

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    http.expectNone('/api/species/boletus-edulis');
  });
});
