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
import type { Photo } from '../../core/api/models';
import { ImageViewComponent } from './image-view.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

async function build(items: Photo[], id = 'zwei'): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(ImageViewComponent, {
    inputs: { slug: 'steinpilz', id },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
  });
  const http = TestBed.inject(HttpTestingController);
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
  return { container, http, router: TestBed.inject(Router), refresh: detectChanges };
}

const TWO = [
  photo({ id: 'eins', lead: true }),
  photo({ id: 'zwei', lead: false, photographer: 'Jonas Weber', lat: 48.51, lon: 9.06 }),
];

describe('ImageViewComponent', () => {
  it('zeigt Zähler, Bild und die Angaben', async () => {
    const { container } = await build(TWO);

    expect(screen.getByText('2 von 2')).toBeInTheDocument();
    expect(screen.getByText('Jonas Weber')).toBeInTheDocument();
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026')).toBeInTheDocument();
    expect(screen.getByText('48,51 · 9,06 · 1 km')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt den Ort weg, wenn keiner am Bild hängt', async () => {
    await build([photo({ id: 'zwei' })]);

    expect(screen.queryByText('Ort')).not.toBeInTheDocument();
  });

  it('setzt das Titelbild', async () => {
    const { http, refresh } = await build(TWO);

    await userEvent.click(screen.getByRole('button', { name: 'Als Titelbild setzen' }));
    http.expectOne('/api/photos/zwei/lead').flush(photo({ id: 'zwei', lead: true }));
    refresh();

    expect(screen.getByText('2 von 2')).toBeInTheDocument();
  });

  it('entfernt das Bild und geht zurück zur Art', async () => {
    const { http, router, refresh } = await build(TWO);

    await userEvent.click(screen.getByRole('button', { name: 'Bild entfernen' }));
    http.expectOne('/api/photos/zwei').flush(null);
    refresh();
    await vi.waitFor(() => {
      expect(router.url).toBe('/arten/steinpilz');
    });
  });

  it('schreibt ein eigenes Foto statt einer Lizenzkennung', async () => {
    await build([photo({ id: 'zwei', licence: 'own' })]);

    expect(screen.getByText('Eigenes Foto')).toBeInTheDocument();
  });
});
