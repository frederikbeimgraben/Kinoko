import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PermissionsService } from '../../core/access/permissions.service';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { photo } from '../../testing/photos-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { SpeciesState } from '../species/species.state';
import { ImageFormComponent } from './image-form.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

/** Ein Gerät, das zeichnen kann: `OffscreenCanvas` fehlt sonst im Test. */
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
      { provide: PermissionsService, useValue: { can: () => curates } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  void TestBed.inject(SpeciesState).loadBundle();
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  detectChanges();
  return { container, http, router: TestBed.inject(Router), refresh: detectChanges };
}

async function pick(container: Element): Promise<void> {
  const field = container.querySelector<HTMLInputElement>('.form__file');
  if (field === null) throw new Error('form__file');
  await userEvent.upload(field, new File(['x'], 'pilz.png', { type: 'image/png' }));
}

describe('ImageFormComponent', () => {
  it('heißt beim Anlegen anders als beim Einreichen', async () => {
    const { container } = await build(true);

    expect(screen.getByRole('heading', { name: 'Bild hinzufügen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('reicht ohne das Recht zur Prüfung ein', async () => {
    await build(false);

    expect(screen.getByRole('heading', { name: 'Bild einreichen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeInTheDocument();
  });

  it('zeigt Quelle und Titelbild-Kästchen nur beim Anlegen', async () => {
    await build(false);

    expect(screen.queryByLabelText('Quelle')).not.toBeInTheDocument();
    expect(screen.queryByText('Als Titelbild der Art')).not.toBeInTheDocument();
  });

  it('nimmt das gewählte Bild als Vorschau', async () => {
    const { container, refresh } = await build(true);

    await pick(container);
    refresh();

    expect(container.querySelector('.form__image')).not.toBeNull();
  });

  it('sendet Foto, Lizenz und Angaben', async () => {
    const { container, http, refresh } = await build(false);

    await pick(container);
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Zur Prüfung einreichen' }));
    const request = await vi.waitFor(() => http.expectOne('/api/photos'));
    const body = request.request.body as FormData;

    expect(body.get('photographer')).toBe('Frederik');
    expect(body.get('licence')).toBe('own');
    expect(body.get('speciesId')).toBe('steinpilz');
    request.flush(photo({ state: 'submitted' }));
  });

  it('sendet die Quelle, die beim Anlegen dasteht', async () => {
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

  it('geht beim Abbrechen zurück zur Art', async () => {
    const { router } = await build(true);

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(router.url).toBe('/arten/steinpilz');
  });
});
