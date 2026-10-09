import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AccountStore } from '../../core/access/account.store';
import { PermissionsStore } from '../../core/access/permissions.store';
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

/** A reviewer sees the lead row. An owner sees only the removal. */
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
        provide: PermissionsStore,
        useValue: { can: (permission: string) => access.reviewer === true && permission === 'image.review' },
      },
      {
        provide: AccountStore,
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
  it('shows the counter, the photo and its data', async () => {
    const { container } = await build(TWO);

    expect(screen.getByText('2 von 2')).toBeInTheDocument();
    expect(screen.getByText('Jonas Weber')).toBeInTheDocument();
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026')).toBeInTheDocument();
    expect(screen.getByText('48,51 · 9,06 · 1 km')).toBeInTheDocument();
    await noViolations(container);
  });

  it('shows a dash for a photo without a place', async () => {
    await build([photo({ id: 'zwei', lat: null, lon: null })]);

    expect(screen.getByText('Ort')).toBeInTheDocument();
    expect(screen.getAllByText('\u2013').length).toBeGreaterThan(0);
  });

  it('shows the caption under its form label', async () => {
    await build([photo({ id: 'zwei', caption: 'Junge Exemplare im Moos' })]);

    expect(screen.getByText('Bildunterschrift')).toBeInTheDocument();
    expect(screen.getByText('Junge Exemplare im Moos')).toBeInTheDocument();
  });

  it('shows no actions to a guest', async () => {
    await build(TWO);

    expect(screen.queryByRole('switch', { name: 'Titelbild' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bild entfernen' })).not.toBeInTheDocument();
  });

  it('shows only the removal to the owner', async () => {
    await build(TWO, 'zwei', { owner: true });

    expect(screen.queryByRole('switch', { name: 'Titelbild' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bild entfernen' })).toBeInTheDocument();
  });

  it('shows the lead row and the removal to a reviewer', async () => {
    await build(TWO, 'zwei', { reviewer: true });

    expect(screen.getByRole('switch', { name: 'Titelbild' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Bild entfernen' })).toBeInTheDocument();
  });

  it('sets the lead photo and locks the switch', async () => {
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

  it('locks the switch of the lead photo from the start', async () => {
    await build(TWO, 'eins', { reviewer: true });

    const toggle = screen.getByRole('switch', { name: 'Titelbild' });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
  });

  it('removes the photo and goes back to the species', async () => {
    const { http, router, refresh } = await build(TWO, 'zwei', { reviewer: true });

    await userEvent.click(screen.getByRole('button', { name: 'Bild entfernen' }));
    http.expectOne('/api/photos/zwei').flush(null);
    refresh();
    await vi.waitFor(() => {
      expect(router.url).toBe('/arten/steinpilz');
    });
  });

  it('writes own photo in place of a licence code', async () => {
    await build([photo({ id: 'zwei', licence: 'own' })]);

    expect(screen.getByText('Eigenes Foto')).toBeInTheDocument();
  });

  it('asks one time and shows a state view when the species has no approved photos', async () => {
    const { http, refresh } = await build([]);

    refresh();
    TestBed.tick();
    refresh();

    http.expectNone('/api/photos?speciesId=steinpilz&state=approved');
    expect(screen.getByText('Bild nicht gefunden')).toBeInTheDocument();
  });
});
