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
import { ImageReviewItemComponent } from './image-review-item.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

async function build(items: Photo[], id = 'eins'): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(ImageReviewItemComponent, {
    inputs: { id },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
  });
  const http = TestBed.inject(HttpTestingController);
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  detectChanges();
  http.expectOne('/api/photos?state=submitted').flush({ items, nextCursor: null });
  detectChanges();
  for (const request of http.match((call) => call.url.startsWith('/api/photos/'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
  await vi.waitFor(() => {
    expect(TestBed.inject(SpeciesState).species().length).toBeGreaterThan(0);
  });
  detectChanges();
  return { container, http, router: TestBed.inject(Router), refresh: detectChanges };
}

const STACK = [
  photo({ id: 'eins', speciesId: 'steinpilz', photographer: 'Jonas Weber', licence: 'cc_by_4' }),
  photo({ id: 'zwei', speciesId: 'maronenroehrling' }),
];

describe('ImageReviewItemComponent', () => {
  it('zeigt Art, Einreichung, Foto und Lizenz', async () => {
    const { container } = await build(STACK);

    expect(screen.getByText('1 von 2')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Jonas Weber · 9. September 2026')).toBeInTheDocument();
    expect(screen.getByText('CC BY 4.0')).toBeInTheDocument();
    await noViolations(container);
  });

  it('gibt frei und geht zurück in den Stapel', async () => {
    const { http, router, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    http.expectOne('/api/photos/eins/approval').flush(photo({ id: 'eins', state: 'approved' }));
    refresh();
    await vi.waitFor(() => {
      expect(router.url).toBe('/verwaltung/bilder');
    });
  });

  it('fragt vor der Absage nach dem Grund und sendet ihn', async () => {
    const { http, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Falsche Art' }));
    refresh();
    const buttons = screen.getAllByRole('button', { name: 'Ablehnen' });
    await userEvent.click(buttons[buttons.length - 1]);
    const request = http.expectOne('/api/photos/eins/rejection');

    expect(request.request.body).toEqual({ reason: 'Falsche Art' });
    request.flush(photo({ id: 'eins', state: 'rejected' }));
  });

  it('tritt hinter dem Blatt zurück', async () => {
    const { container, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    refresh();

    expect(container.querySelector('.item--dimmed')).not.toBeNull();
  });

  it('führt mit Zurück in den Stapel', async () => {
    const { router } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(router.url).toBe('/verwaltung/bilder');
  });
});
