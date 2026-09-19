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
import { ImageQueueComponent } from './image-queue.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

async function build(items: Photo[]): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(ImageQueueComponent, {
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
  photo({
    id: 'eins',
    speciesId: 'steinpilz',
    photographer: 'Jonas Weber',
    ownerName: 'Jonas',
    caption: 'Junge Exemplare',
  }),
  photo({ id: 'zwei', speciesId: 'maronenroehrling', licence: 'cc_by_4' }),
];

describe('ImageQueueComponent', () => {
  it('zeigt die oberste Karte mit Art, Lizenz und Unterschrift', async () => {
    const { container } = await build(STACK);

    expect(screen.getByText('1 von 2')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Junge Exemplare')).toBeInTheDocument();
    expect(screen.getByText('Jonas · 6. Sept.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('gibt mit dem Haken frei und zählt weiter', async () => {
    const { http, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    http.expectOne('/api/photos/eins/approval').flush(photo({ id: 'eins', state: 'approved' }));
    refresh();

    expect(screen.getByText('2 von 2')).toBeInTheDocument();
  });

  it('fragt vor einer Absage nach dem Grund', async () => {
    const { refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    refresh();

    expect(screen.getByRole('dialog', { name: 'Warum lehnst du ab?' })).toBeInTheDocument();
  });

  it('sendet den Grund der Absage', async () => {
    const { http, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Unscharf' }));
    refresh();
    const buttons = screen.getAllByRole('button', { name: 'Ablehnen' });
    await userEvent.click(buttons[buttons.length - 1]);
    const request = http.expectOne('/api/photos/eins/rejection');

    expect(request.request.body).toEqual({ reason: 'Unscharf' });
    request.flush(photo({ id: 'eins', state: 'rejected' }));
  });

  it('geht zurück in die Verwaltung', async () => {
    const { router } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(router.url).toBe('/verwaltung');
  });
});
