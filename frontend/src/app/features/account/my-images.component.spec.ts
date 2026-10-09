import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Find, Photo } from '../../core/api/models';
import { FIND } from '../../testing/entries-fixture';
import { EntriesStore } from '../entries/entries.store';
import { noViolations } from '../../testing/axe';
import { photo } from '../../testing/photos-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { SpeciesStore } from '../species/species.store';
import { MyImagesComponent } from './my-images.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

async function build(items: Photo[], nextCursor: string | null = null, finds: Find[] = []): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:one',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(MyImagesComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter(ANY_ROUTE),
      // A find photo takes its species from the own find.
      {
        provide: EntriesStore,
        useValue: { finds: signal(finds), signedIn: signal(true), loadOnSignIn: () => undefined },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  http.expectOne('/api/photos?mine=true').flush({ items, nextCursor });
  detectChanges();
  for (const request of http.match((call) => call.url.endsWith('/list'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
  await vi.waitFor(() => {
    expect(TestBed.inject(SpeciesStore).species().length).toBeGreaterThan(0);
  });
  detectChanges();
  return { container, http, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('MyImagesComponent', () => {
  it('shows each photo with its day, its state and a badge', async () => {
    const { container } = await build([
      photo({ id: 'image-one', speciesId: 'steinpilz', state: 'approved' }),
      photo({ id: 'image-two', speciesId: 'maronenroehrling', state: 'submitted' }),
    ]);

    expect(screen.getByText('9. Sept. · freigegeben')).toBeInTheDocument();
    expect(screen.getByText('frei')).toBeInTheDocument();
    expect(screen.getByText('9. Sept. · in Prüfung')).toBeInTheDocument();
    expect(screen.getByText('offen')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    await noViolations(container);
  });

  it('names a find photo after the species of its find', async () => {
    await build(
      [
        photo({ id: 'find-photo', speciesId: null, findId: FIND.id, state: 'private' }),
        photo({ id: 'other-photo', speciesId: null, findId: 'unknown-find', state: 'private' }),
      ],
      null,
      [FIND],
    );

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Fundfoto')).toBeInTheDocument();
  });

  it('names the reason of a rejection', async () => {
    await build([photo({ id: 'image-three', state: 'rejected', rejectReason: 'unscharf' })]);

    expect(screen.getByText('9. Sept. · abgelehnt: unscharf')).toBeInTheDocument();
  });

  it('opens the image page of a known species', async () => {
    const { router } = await build([photo({ id: 'image-one', speciesId: 'steinpilz' })]);
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    expect(navigate).toHaveBeenCalledWith(['/arten', 'steinpilz', 'bilder', 'image-one']);
  });

  it('gives no link to a photo that is not approved', async () => {
    await build([photo({ id: 'image-two', speciesId: 'steinpilz', state: 'submitted' })]);

    expect(screen.queryByRole('button', { name: /Steinpilz/ })).not.toBeInTheDocument();
  });

  it('shows the empty state without a photo', async () => {
    await build([]);

    expect(screen.getByText('Du hast noch kein Bild eingereicht.')).toBeInTheDocument();
  });

  it('gets the next page by the cursor', async () => {
    const first = ['one', 'two'].map((id) => photo({ id, state: 'approved' }));
    const { http, refresh } = await build(first, 'cursor-one');

    await userEvent.click(screen.getByRole('button', { name: 'Mehr laden' }));
    http.expectOne('/api/photos?mine=true&cursor=cursor-one').flush({
      items: [photo({ id: 'three', state: 'rejected', rejectReason: 'Unscharf.' })],
      nextCursor: null,
    });
    refresh();
    for (const request of http.match((call) => call.url.endsWith('/list'))) {
      request.flush(new Blob(['x'], { type: 'image/jpeg' }));
    }
    refresh();

    expect(screen.getByText('9. Sept. · abgelehnt: Unscharf.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).not.toBeInTheDocument();
  });
});
