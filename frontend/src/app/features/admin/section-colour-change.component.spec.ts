import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionColourChangeComponent } from './section-colour-change.component';
import { SpeciesEditorStore } from './species-editor.store';
import { TermsStore } from './terms.store';
import { SECTION_SPECIES } from './section.testing';

const TERMS = {
  items: [
    { id: 'a-1', kind: 'trigger', group: 'mechanical', slug: 'pressure', name: 'Druck', position: 1 },
    { id: 'a-2', kind: 'trigger', group: 'mechanical', slug: 'cut', name: 'Anschnitt', position: 2 },
    { id: 'a-3', kind: 'trigger', group: 'reagent', slug: 'koh', name: 'Kalilauge (KOH)', position: 3 },
  ],
};

const PALETTE = [{ key: 'brown', hex: '#7a5230' }];

const WITH_CHANGE = {
  ...SECTION_SPECIES,
  colourChanges: [
    {
      part: 'flesh',
      kind: 'mechanical',
      from: { name: 'weiß', hex: '#f4efe2' },
      to: { name: 'blau', hex: '#5b7fb0' },
      speed: '1min',
      triggers: [{ id: 'a-1', slug: 'pressure', name: 'Druck', kind: 'trigger' }],
    },
  ],
};

function routeFor(
  part: string,
  index: string,
  query: Record<string, string>,
): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', part, index });
  return {
    provide: ActivatedRoute,
    useValue: { paramMap: of(map), queryParamMap: of(convertToParamMap(query)), snapshot: { paramMap: map } },
  };
}

async function build(
  part = 'flesh',
  index = '0',
  query: Record<string, string> = {},
): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionColourChangeComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      routeFor(part, index, query),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(WITH_CHANGE);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  http.expectOne('/api/terms').flush(TERMS);
  http.expectOne('/api/species/bundle').flush({ items: [], standardColours: PALETTE, facets: {} });
  return { container, http };
}

describe('SectionColourChangeComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
    TestBed.inject(TermsStore);
  });

  it('nennt Teil, Auslöser, beide Farben und die Dauer', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Verfärbung' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Teil/ })).toHaveTextContent('Fleisch');
    expect(screen.getByRole('button', { name: /von/ })).toHaveTextContent('weiß');
    expect(screen.getByRole('button', { name: /nach/ })).toHaveTextContent('blau');
    expect(screen.getByRole('button', { name: 'Druck' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1 min' })).toHaveAttribute('aria-pressed', 'true');
    await noViolations(container);
  });

  it('schreibt Auslöser und Dauer an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Verfärbung' });

    await userEvent.click(screen.getByRole('button', { name: 'Anschnitt' }));
    await userEvent.click(screen.getByRole('button', { name: '3 min' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    const body = call.request.body as { colourChanges: { speed: string; triggers: { id: string }[] }[] };
    expect(body.colourChanges[0].speed).toBe('3min');
    expect(body.colourChanges[0].triggers.map((one) => one.id)).toEqual(['a-1', 'a-2']);
  });

  it('nimmt die Verfärbung heraus', async () => {
    const { http } = await build();
    await screen.findByRole('heading', { name: 'Verfärbung' });

    await userEvent.click(screen.getByRole('button', { name: 'Verfärbung entfernen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect((call.request.body as { colourChanges: unknown[] }).colourChanges).toEqual([]);
  });

  it('zeigt nur die Auslöser der gewählten Gruppe', async () => {
    await build();
    await screen.findByRole('heading', { name: 'Verfärbung' });

    expect(screen.queryByRole('button', { name: 'Kalilauge (KOH)' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Reagenz' }));

    expect(screen.getByRole('button', { name: 'Kalilauge (KOH)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Druck' })).not.toBeInTheDocument();
  });

  it('legt eine neue Verfärbung mit Auslöser und Farbe an', async () => {
    const { http } = await build('cap', '1');
    await screen.findByRole('heading', { name: 'Verfärbung' });

    expect(screen.queryByRole('button', { name: 'Verfärbung entfernen' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Reagenz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Kalilauge (KOH)' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Braun' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const body = http.expectOne('/api/species/boletus-edulis').request.body as {
      colourChanges: {
        part: string;
        kind: string;
        to: { hex: string; name: string };
        triggers: { id: string }[];
      }[];
    };
    expect(body.colourChanges).toHaveLength(2);
    expect(body.colourChanges[1]).toMatchObject({
      part: 'cap',
      kind: 'reagent',
      to: { hex: '#7a5230', name: 'Braun' },
      triggers: [{ id: 'a-3' }],
    });
  });

  it('öffnet eine neue Verfärbung aus „Reagenz hinzufügen“ auf dem Reiter Reagenz', async () => {
    await build('cap', '1', { ausloeser: 'reagent' });
    await screen.findByRole('heading', { name: 'Verfärbung' });

    expect(screen.getByRole('tab', { name: 'Reagenz' })).toHaveAttribute('aria-selected', 'true');
  });

  it('schreibt eine neue Verfärbung ohne Auslöser nicht', async () => {
    const { http } = await build('cap', '1');
    await screen.findByRole('heading', { name: 'Verfärbung' });

    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    http.expectNone('/api/species/boletus-edulis');
  });

  it('zeigt bei einem deutschen Teilnamen den Zustand nicht gefunden', async () => {
    await build('hut', '0');

    expect(await screen.findByText('Teil nicht gefunden')).toBeInTheDocument();
  });
});
