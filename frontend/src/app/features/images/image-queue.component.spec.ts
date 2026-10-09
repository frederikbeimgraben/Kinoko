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
import { SpeciesStore } from '../species/species.store';
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
    expect(TestBed.inject(SpeciesStore).species().length).toBeGreaterThan(0);
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
  it('zeigt die oberste Karte mit Art, Unterschrift und den Zeilen des Boards', async () => {
    const { container } = await build(STACK);

    expect(screen.getByText('2 offene Bilder')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Junge Exemplare')).toBeInTheDocument();
    expect(screen.getByText('Jonas Weber')).toBeInTheDocument();
    expect(screen.getAllByText('9. September').length).toBeGreaterThan(0);
    await noViolations(container);
  });

  it('gibt mit dem Haken frei und zählt herunter', async () => {
    const { http, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    http.expectOne('/api/photos/eins/approval').flush(photo({ id: 'eins', state: 'approved' }));
    refresh();

    expect(screen.getByText('1 offenes Bild')).toBeInTheDocument();
  });

  it('nimmt eine Freigabe auch beim Dienst zurück', async () => {
    const { http, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    http.expectOne('/api/photos/eins/approval').flush(photo({ id: 'eins', state: 'approved' }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await vi.waitFor(() => {
      const request = http.expectOne({ url: '/api/photos/eins/review', method: 'DELETE' });
      request.flush(photo({ id: 'eins', state: 'submitted' }));
    });
    refresh();

    expect(screen.getByText('2 offene Bilder')).toBeInTheDocument();
  });

  it('lässt die letzte Entscheidung rückgängig machen und zeigt dann den leeren Stapel', async () => {
    const { http, refresh } = await build([STACK[0]]);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    http.expectOne('/api/photos/eins/approval').flush(photo({ id: 'eins', state: 'approved' }));
    refresh();

    expect(screen.getByText('Keine Bilder offen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled();
  });

  it('zeigt ohne offene Bilder den leeren Zustand des Boards', async () => {
    await build([]);

    expect(screen.getByText('Keine Bilder offen')).toBeInTheDocument();
    expect(screen.getByText('0 offene Bilder')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Freigeben' })).not.toBeInTheDocument();
  });

  it('behält die Karte, wenn die Frage nach dem Grund abgebrochen wird', async () => {
    const { http, refresh } = await build(STACK);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    refresh();
    const backs = screen.getAllByRole('button', { name: 'Zurück' });
    await userEvent.click(backs[backs.length - 1]);
    refresh();

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('2 offene Bilder')).toBeInTheDocument();
    http.expectNone((call) => call.url.endsWith('/rejection'));
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
