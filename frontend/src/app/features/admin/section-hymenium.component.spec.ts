import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionHymeniumComponent } from './section-hymenium.component';
import { SpeciesEditorStore } from './species-editor.store';
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

// The sheet has many buttons. Under load, a query by role takes longer.
describe('SectionHymeniumComponent', { timeout: 20_000 }, () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
  });

  it('nennt die vier Felder und die Wahl des offenen Feldes', async () => {
    const { container } = await build();

    expect(await screen.findByText('Ansatz am Stiel')).toBeInTheDocument();
    expect(screen.getByText('Stand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'herablaufend' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt den gewählten Stand', async () => {
    const { http } = await build();
    await screen.findByText('Ansatz am Stiel');

    await userEvent.click(screen.getByRole('button', { name: 'entfernt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.body).toEqual(
      expect.objectContaining({ gillSpacing: 'distant', hymeniumType: 'gills' }),
    );
  });

  it('nennt die Art mit ihrem Namen und leert die Lamellenfelder bei Röhren', async () => {
    const { http } = await build();
    await screen.findByText('Ansatz am Stiel');

    expect(screen.getByText('Art')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Röhren' }));
    expect(screen.queryByText('Ansatz am Stiel')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.body).toEqual(
      expect.objectContaining({
        hymeniumType: 'tubes',
        gillAttachment: null,
        gillSpacing: null,
        gillEdge: null,
      }),
    );
  });

  it('führt von der Farbe auf die Farbe der Fruchtschicht', async () => {
    await build();
    await screen.findByText('Ansatz am Stiel');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: /Lamellenfarbe/ }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/arten', 'boletus-edulis', 'farbe', 'gills', 0]);
  });
});
