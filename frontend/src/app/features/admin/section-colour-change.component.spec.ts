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
import { SpeciesEditorState } from './species-editor.state';
import { TermsState } from './terms.state';
import { SECTION_SPECIES } from './section.testing';

const TERMS = {
  items: [
    { id: 'a-1', kind: 'trigger', group: 'mechanical', slug: 'pressure', name: 'Druck', position: 1 },
    { id: 'a-2', kind: 'trigger', group: 'mechanical', slug: 'cut', name: 'Anschnitt', position: 2 },
  ],
};

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

function routeFor(): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', index: '0' });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionColourChangeComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(WITH_CHANGE);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  http.expectOne('/api/terms').flush(TERMS);
  return { container, http };
}

describe('SectionColourChangeComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
    TestBed.inject(TermsState);
  });

  it('nennt Teil, Auslöser, beide Farben und die Dauer', async () => {
    const { container } = await build();

    expect(await screen.findByRole('heading', { name: 'Verfärbung' })).toBeInTheDocument();
    expect(screen.getByText('#F4EFE2')).toBeInTheDocument();
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
});
