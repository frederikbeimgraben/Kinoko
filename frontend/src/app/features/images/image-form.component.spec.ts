import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PermissionsStore } from '../../core/access/permissions.store';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { photo } from '../../testing/photos-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { SpeciesStore } from '../species/species.store';
import { ImageFormComponent } from './image-form.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

/** A device that can draw: the test has no `OffscreenCanvas` of its own. */
function stubCanvas(): void {
  vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 100, height: 80, close: () => undefined }),
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext(): unknown {
        return { drawImage: () => undefined };
      }
      convertToBlob(): Promise<Blob> {
        return Promise.resolve(new Blob(['x'], { type: 'image/jpeg' }));
      }
    },
  );
}

async function build(curates: boolean): Promise<Setup> {
  stubCanvas();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(ImageFormComponent, {
    inputs: { slug: 'steinpilz' },
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter(ANY_ROUTE),
      ...authStubProviders(new AuthStub()),
      { provide: PermissionsStore, useValue: { can: () => curates } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  void TestBed.inject(SpeciesStore).loadBundle();
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  detectChanges();
  return { container, http, router: TestBed.inject(Router), refresh: detectChanges };
}

async function pick(container: Element): Promise<void> {
  const field = container.querySelector<HTMLInputElement>('app-photo-strip input[type=file]');
  if (field === null) throw new Error('photo strip input');
  await userEvent.upload(field, new File(['x'], 'pilz.jpg', { type: 'image/jpeg' }));
}

describe('ImageFormComponent', () => {
  it('has another title to add than to submit', async () => {
    const { container } = await build(true);

    expect(await screen.findByRole('heading', { name: 'Bild hinzufügen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('submits for review without the right to review', async () => {
    await build(false);

    expect(await screen.findByRole('heading', { name: 'Bild einreichen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Einreichen' })).toBeInTheDocument();
  });

  it('shows the source and the lead check box only to add', async () => {
    await build(false);

    expect(screen.queryByLabelText('Quelle')).not.toBeInTheDocument();
    expect(screen.queryByText('Als Titelbild der Art')).not.toBeInTheDocument();
  });

  it('shows the chosen photo as a tile of the strip', async () => {
    const { container, refresh } = await build(true);

    await pick(container);
    refresh();

    expect(container.querySelector('app-photo-strip .pht img')).not.toBeNull();
  });

  it('sends the photo, the licence and the data', async () => {
    const { container, http, refresh } = await build(false);

    await pick(container);
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Einreichen' }));
    const request = await vi.waitFor(() => http.expectOne('/api/photos'));
    const body = request.request.body as FormData;

    expect(body.get('photographer')).toBe('Frederik');
    expect(body.get('licence')).toBe('own');
    expect(body.get('speciesId')).toBe('steinpilz');
    request.flush(photo({ state: 'submitted' }));
  });

  it('sends the source of an added photo', async () => {
    const { container, http, refresh } = await build(true);

    await pick(container);
    refresh();
    await userEvent.type(screen.getByRole('textbox', { name: 'Quelle' }), '123pilzsuche.de');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => http.expectOne('/api/photos'));
    const body = request.request.body as FormData;

    expect(body.get('source')).toBe('123pilzsuche.de');
    request.flush(photo({ state: 'approved' }));
  });

  it('chooses a licence in the option sheet', async () => {
    const { container, http, refresh } = await build(false);

    await pick(container);
    refresh();
    await userEvent.click(screen.getByText('Eigenes Foto'));
    await userEvent.click(await screen.findByText('CC0'));
    await userEvent.click(screen.getByRole('button', { name: 'Einreichen' }));
    const request = await vi.waitFor(() => http.expectOne('/api/photos'));
    const body = request.request.body as FormData;

    expect(body.get('licence')).toBe('cc0');
    request.flush(photo({ state: 'submitted' }));
  });

  it('goes back to the species when the person closes the sheet', async () => {
    const { router } = await build(true);

    const sheet = await screen.findByRole('dialog', { name: 'Bild hinzufügen' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Schließen' }));

    expect(router.url).toBe('/arten/steinpilz');
  });
});
