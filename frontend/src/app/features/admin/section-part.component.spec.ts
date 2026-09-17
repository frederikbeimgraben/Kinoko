import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionPartComponent } from './section-part.component';
import { SpeciesEditorState } from './species-editor.state';
import { SECTION_SPECIES } from './section.testing';

function routeFor(part: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis', part });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

async function build(part = 'cap'): Promise<Element> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionPartComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor(part)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return container;
}

describe('SectionPartComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorState).load('');
  });

  it('nennt das Teil im Kopf und je Wert eine Zeile', async () => {
    const container = await build();

    expect(await screen.findByRole('heading', { name: 'Hut' })).toBeInTheDocument();
    expect(screen.getByText('Breite')).toBeInTheDocument();
    expect(screen.getByText('4 bis 20 cm')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt ohne Werte leer, führt aber die Zeilen zum Anlegen', async () => {
    await build('spore');

    expect(await screen.findByRole('heading', { name: 'Sporen' })).toBeInTheDocument();
    expect(screen.queryByText('Breite')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maß hinzufügen' })).toBeInTheDocument();
  });
});
