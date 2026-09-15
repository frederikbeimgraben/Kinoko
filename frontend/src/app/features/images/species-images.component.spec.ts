import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { photo } from '../../testing/photos-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { SpeciesState } from '../species/species.state';
import type { Photo } from '../../core/api/models';
import { SpeciesImagesComponent } from './species-images.component';

interface Setup {
  container: Element;
  router: Router;
  refresh: () => void;
}

async function build(items: Photo[]): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(SpeciesImagesComponent, {
    inputs: { slug: 'steinpilz' },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
  });
  const http = TestBed.inject(HttpTestingController);
  void TestBed.inject(SpeciesState).loadBundle();
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  detectChanges();
  await vi.waitFor(() => {
    http.expectOne('/api/photos?speciesId=steinpilz&state=approved').flush({ items, nextCursor: null });
  });
  detectChanges();
  for (const request of http.match((call) => call.url.startsWith('/api/photos/'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
  detectChanges();
  return { container, router: TestBed.inject(Router), refresh: detectChanges };
}

/** Sucht ein Element und wirft, wenn es fehlt. */
function pickOne(root: Element, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(selector);
  return found;
}

describe('SpeciesImagesComponent', () => {
  it('zeigt das Titelbild groß und die weiteren als Streifen', async () => {
    const { container } = await build([
      photo({ id: 'eins', lead: true }),
      photo({ id: 'zwei', lead: false }),
      photo({ id: 'drei', lead: false }),
    ]);

    expect(container.querySelectorAll('.gallery__thumb')).toHaveLength(2);
    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt von der Kachel zum Bild', async () => {
    const { container, router } = await build([photo({ id: 'eins' }), photo({ id: 'zwei' })]);
    const thumb = pickOne(container, '.gallery__thumb');

    await userEvent.click(thumb);

    expect(router.url).toBe('/arten/steinpilz/bilder/zwei');
  });

  it('führt von der gestrichelten Kachel zum Formular', async () => {
    const { container, router } = await build([]);

    await userEvent.click(pickOne(container, '.gallery__add'));

    expect(router.url).toBe('/arten/steinpilz/bilder/neu');
  });

  it('zeigt ohne Bild nur den Weg zum Hinzufügen', async () => {
    const { container } = await build([]);

    expect(container.querySelector('.gallery__lead')).toBeNull();
    expect(container.querySelector('.gallery__add')).not.toBeNull();
  });
});
