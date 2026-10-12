import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionReactionComponent } from './section-reaction.component';
import { cleanSources } from './section-reaction.rows';
import { SpeciesEditorStore } from './species-editor.store';
import { TermsStore } from './terms.store';
import { SECTION_SPECIES } from './section.testing';

const TERMS = {
  items: [
    { id: 'r-1', kind: 'trigger', group: 'reagent', slug: 'koh', name: 'Kalilauge', position: 1 },
    { id: 'r-2', kind: 'trigger', group: 'reagent', slug: 'feso4', name: 'Eisensulfat', position: 2 },
    { id: 'r-3', kind: 'trigger', group: 'mechanical', slug: 'cut', name: 'Anschnitt', position: 3 },
  ],
};

const PALETTE = [
  { key: 'yellow', hex: '#e0b446' },
  { key: 'green', hex: '#4a7a3a' },
];

const KOH = {
  reagent: { slug: 'koh', name: 'Kalilauge' },
  reading: 'KOH auf Huthaut gelb',
  part: 'cap',
  location: null,
  result: 'positive',
  colour: { name: 'gelb', hex: '#e0b446', nearest: '#e0b446' },
  contested: false,
  partlyConfirmed: false,
  sources: [{ label: 'Pilzbuch', url: null, year: '1999' }],
};

async function build(index: string): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const map = convertToParamMap({ slug: 'boletus-edulis', index });
  const { container } = await render(SectionReactionComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush({ ...SECTION_SPECIES, reactions: [KOH] });
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  http.expectOne('/api/terms').flush(TERMS);
  http.expectOne('/api/species/bundle').flush({ items: [], standardColours: PALETTE, facets: {} });
  return { container, http };
}

describe('cleanSources', () => {
  it('lässt Quellen ohne Titel weg und leert leere Felder', () => {
    expect(
      cleanSources([
        { label: ' Buch ', url: ' ', year: '2001 ' },
        { label: '  ', url: 'https://example.test', year: null },
      ]),
    ).toEqual([{ label: 'Buch', url: null, year: '2001' }]);
  });
});

describe('SectionReactionComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
    TestBed.inject(TermsStore);
  });

  it('zeigt die gespeicherte Reaktion', async () => {
    const { container } = await build('0');

    expect(await screen.findByRole('heading', { name: 'Reaktion' })).toBeInTheDocument();
    const reagents = screen.getByRole('group', { name: 'Reagenz' });
    expect(within(reagents).getByRole('button', { name: 'Kalilauge' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(reagents).queryByRole('button', { name: 'Anschnitt' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Wortlaut' })).toHaveValue('KOH auf Huthaut gelb');
    expect(screen.getByRole('tab', { name: 'positiv' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Titel')).toHaveValue('Pilzbuch');
    expect(screen.getByLabelText('Jahr')).toHaveValue('1999');
    await noViolations(container);
  });

  it('schreibt eine geänderte Reaktion mit ihren Quellen', async () => {
    const { http } = await build('0');
    await screen.findByRole('heading', { name: 'Reaktion' });

    await userEvent.click(screen.getByRole('tab', { name: 'wechselnd' }));
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Teil' })).getByRole('button', { name: 'Hut' }),
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Stelle' }), 'Huthaut');
    await userEvent.click(screen.getByRole('button', { name: 'Keine Farbe' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Umstritten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quelle entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quelle hinzufügen' }));
    await userEvent.type(screen.getByLabelText('Titel'), 'Eigene Probe');
    await userEvent.type(screen.getByLabelText('Adresse'), 'https://example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as { reactions: unknown };
    expect(body.reactions).toEqual([
      {
        reagent: { slug: 'koh', name: 'Kalilauge' },
        reading: 'KOH auf Huthaut gelb',
        part: null,
        location: 'Huthaut',
        result: 'variable',
        colour: null,
        contested: true,
        partlyConfirmed: false,
        sources: [{ label: 'Eigene Probe', url: 'https://example.test', year: null }],
      },
    ]);
  });

  it('hängt eine neue Reaktion an', async () => {
    const { http } = await build('1');
    await screen.findByRole('heading', { name: 'Reaktion' });

    expect(screen.queryByRole('button', { name: 'Reaktion entfernen' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    http.expectNone('/api/species/boletus-edulis');

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Reagenz' })).getByRole('button', { name: 'Eisensulfat' }),
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Wortlaut' }), 'FeSO4 grün');
    await userEvent.click(screen.getByRole('radio', { name: 'Grün' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Nur teilweise bestätigt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as {
      reactions: { reagent: { slug: string }; colour: unknown; partlyConfirmed: boolean }[];
    };
    expect(body.reactions.map((one) => one.reagent.slug)).toEqual(['koh', 'feso4']);
    expect(body.reactions[1].colour).toEqual({ name: 'Grün', hex: '#4a7a3a' });
    expect(body.reactions[1].partlyConfirmed).toBe(true);
  });

  it('entfernt die Reaktion', async () => {
    const { http } = await build('0');
    await screen.findByRole('heading', { name: 'Reaktion' });

    await userEvent.click(screen.getByRole('button', { name: 'Reaktion entfernen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as { reactions: unknown[] };
    expect(body.reactions).toEqual([]);
  });

  it('wählt ein Reagenz wieder ab', async () => {
    const { http } = await build('0');
    await screen.findByRole('heading', { name: 'Reaktion' });

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Reagenz' })).getByRole('button', { name: 'Kalilauge' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    http.expectNone('/api/species/boletus-edulis');
  });
});
