import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AccountService } from '../../core/access/account.service';
import { PermissionsService } from '../../core/access/permissions.service';
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

/** Wer prüft, sieht die Titelbild-Zeile. Wer besitzt, nur das Entfernen. */
interface Access {
  reviewer?: boolean;
  owner?: boolean;
}

async function build(items: Photo[], id = 'zwei', access: Access = {}): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(ImageViewComponent, {
    inputs: { slug: 'steinpilz', id },
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter(ANY_ROUTE),
      {
        provide: PermissionsService,
        useValue: { can: (permission: string) => access.reviewer === true && permission === 'image.review' },
      },
      {
        provide: AccountService,
        useValue: { owns: (ownerId: string | null) => access.owner === true && ownerId !== null },
      },
    ],
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

  it('zeigt als Gast keine Aktionen', async () => {
    await build(TWO);

    expect(screen.queryByRole('switch', { name: 'Titelbild' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bild entfernen' })).not.toBeInTheDocument();
  });

  it('zeigt als Besitzer nur Entfernen', async () => {
    await build(TWO, 'zwei', { owner: true });

    expect(screen.queryByRole('switch', { name: 'Titelbild' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bild entfernen' })).toBeInTheDocument();
  });

  it('zeigt als Prüfer die Titelbild-Zeile und das Entfernen', async () => {
    await build(TWO, 'zwei', { reviewer: true });

    expect(screen.getByRole('switch', { name: 'Titelbild' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Bild entfernen' })).toBeInTheDocument();
  });

  it('setzt das Titelbild und sperrt den Schalter', async () => {
    const { http, refresh } = await build(TWO, 'zwei', { reviewer: true });

    await userEvent.click(screen.getByRole('switch', { name: 'Titelbild' }));
    http.expectOne('/api/photos/zwei/lead').flush(photo({ id: 'zwei', lead: true }));

    await vi.waitFor(() => {
      refresh();
      const toggle = screen.getByRole('switch', { name: 'Titelbild' });
      expect(toggle).toBeChecked();
      expect(toggle).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('sperrt den Schalter am Titelbild von Anfang an', async () => {
    await build(TWO, 'eins', { reviewer: true });

    const toggle = screen.getByRole('switch', { name: 'Titelbild' });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
  });

  it('entfernt das Bild und geht zurück zur Art', async () => {
    const { http, router, refresh } = await build(TWO, 'zwei', { reviewer: true });

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
