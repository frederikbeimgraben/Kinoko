import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionTextsComponent } from './section-texts.component';
import { withTexts } from './section-texts.rows';
import { SpeciesEditorStore } from './species-editor.store';
import { SECTION_SPECIES } from './section.testing';

const WITH_TEXTS = {
  ...SECTION_SPECIES,
  traits: [
    { key: 'cap', text: 'Braun.' },
    { key: 'habitat', text: 'Laubwald.' },
  ],
};

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const map = convertToParamMap({ slug: 'boletus-edulis' });
  const { container } = await render(SectionTextsComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(WITH_TEXTS);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('withTexts', () => {
  it('ersetzt nur die Texte der Seite und lässt leere weg', () => {
    const traits = withTexts(
      [
        { key: 'cap', text: 'Braun.' },
        { key: 'habitat', text: 'Alt.' },
        { key: 'milk', text: 'Weiß.' },
      ],
      { habitat: ' Laubwald. ', milk: '  ' },
    );

    expect(traits).toEqual([
      { key: 'cap', text: 'Braun.' },
      { key: 'habitat', text: 'Laubwald.' },
    ]);
  });
});

describe('SectionTextsComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
  });

  it('zeigt die Texte ohne Körperteil', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Weitere Texte' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Vorkommen' })).toHaveValue('Laubwald.');
    expect(screen.getByRole('textbox', { name: 'Milch' })).toHaveValue('');
    expect(screen.queryByDisplayValue('Braun.')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt die Texte und behält die Texte der Teile', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Weitere Texte' });

    await userEvent.type(screen.getByRole('textbox', { name: 'Milch' }), 'Weiß, mild.');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Vorkommen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as { traits: unknown };
    expect(body.traits).toEqual([
      { key: 'cap', text: 'Braun.' },
      { key: 'milk', text: 'Weiß, mild.' },
    ]);
  });
});
