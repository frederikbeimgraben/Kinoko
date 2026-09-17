import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionHymeniumComponent } from './section-hymenium.component';
import { SpeciesEditorState } from './species-editor.state';
import { SECTION_SPECIES } from './section.testing';

function routeFor(): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis' });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionHymeniumComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('SectionHymeniumComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
  });

  it('nennt die vier Felder und die Wahl des offenen Feldes', async () => {
    const { container } = await build();

    expect(await screen.findByText('Ansatz am Stiel')).toBeInTheDocument();
    expect(screen.getByText('Stand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'herablaufend' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('öffnet ein anderes Feld und schreibt den gewählten Wert', async () => {
    const { http } = await build();
    await screen.findByText('Ansatz am Stiel');

    await userEvent.click(screen.getByRole('button', { name: /Stand/ }));
    await userEvent.click(screen.getByRole('button', { name: 'entfernt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.body).toEqual(expect.objectContaining({ gillSpacing: 'distant' }));
  });
});
