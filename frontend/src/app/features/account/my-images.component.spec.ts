import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { photo } from '../../testing/photos-fixture';
import type { Photo } from '../../core/api/models';
import { MyImagesComponent } from './my-images.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  refresh: () => void;
}

async function build(items: Photo[], nextCursor: string | null = null): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(MyImagesComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
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
  detectChanges();
  return { container, http, refresh: detectChanges };
}

describe('MyImagesComponent', () => {
  it('zeigt je Einreichung den Zustand', async () => {
    const { container } = await build([
      photo({ id: 'bild-eins', speciesId: 'steinpilz', state: 'approved' }),
      photo({ id: 'bild-zwei', speciesId: 'maronenroehrling', state: 'submitted' }),
    ]);

    expect(screen.getByText('Freigegeben')).toBeInTheDocument();
    expect(screen.getByText('Eingereicht')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    await noViolations(container);
  });

  it('nennt bei einer Absage den Grund', async () => {
    await build([
      photo({
        id: 'bild-drei',
        state: 'rejected',
        rejectReason: 'Unscharf, die Röhren sind nicht zu erkennen.',
      }),
    ]);

    expect(screen.getByText('Abgelehnt')).toBeInTheDocument();
    expect(screen.getByText('Unscharf, die Röhren sind nicht zu erkennen.')).toBeInTheDocument();
  });

  it('zeigt ohne Einreichung den Leerzustand', async () => {
    await build([]);

    expect(screen.getByText('Du hast noch kein Bild eingereicht.')).toBeInTheDocument();
  });

  it('holt die nächste Seite über den Zeiger', async () => {
    const first = ['eins', 'zwei'].map((id) => photo({ id, state: 'approved' }));
    const { http, refresh } = await build(first, 'zeiger-eins');

    await userEvent.click(screen.getByRole('button', { name: 'Mehr laden' }));
    http.expectOne('/api/photos?mine=true&cursor=zeiger-eins').flush({
      items: [photo({ id: 'drei', state: 'rejected', rejectReason: 'Unscharf.' })],
      nextCursor: null,
    });
    refresh();
    for (const request of http.match((call) => call.url.endsWith('/list'))) {
      request.flush(new Blob(['x'], { type: 'image/jpeg' }));
    }
    refresh();

    expect(screen.getByText('Unscharf.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).not.toBeInTheDocument();
  });
});
