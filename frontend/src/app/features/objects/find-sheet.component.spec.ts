import { provideHttpClient } from '@angular/common/http';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SpeciesStore } from '../species/species.store';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { AccountStore } from '../../core/access/account.store';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND } from '../../testing/entries-fixture';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { FindSheetComponent } from './find-sheet.component';

/** A shared find always has a group: the service refuses a share without one. */
const GROUPED = { ...FIND, groupId: 'gruppe-eins' };

/** The account and the catalogue are the same for each test of this sheet. */
function provider(owns = true): (EnvironmentProviders | Provider)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    ...authStubProviders(new AuthStub()),
    { provide: AccountStore, useValue: { owns: () => owns } },
  ];
}

/** The catalogue gets into the state through the storage, not with the call. */
async function catalogueReady(): Promise<void> {
  const catalogue = TestBed.inject(SpeciesStore);
  await vi.waitFor(() => {
    expect(catalogue.species()).not.toHaveLength(0);
  });
}

interface Setup {
  container: Element;
  closed: number;
  toasts: ToastSpy;
  http: HttpTestingController;
  refresh: () => void;
}

interface BuildOptions {
  find?: typeof FIND;
  owns?: boolean;
}

async function build(options: BuildOptions = {}): Promise<Setup> {
  const { find = GROUPED, owns = true } = options;
  const { container, detectChanges, fixture } = await render(FindSheetComponent, {
    inputs: { find },
    providers: provider(owns),
  });
  const http = TestBed.inject(HttpTestingController);
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  await catalogueReady();
  detectChanges();
  let closed = 0;
  fixture.componentInstance.closed.subscribe(() => (closed += 1));
  return {
    container,
    toasts: toastSpy(),
    http,
    refresh: detectChanges,
    get closed() {
      return closed;
    },
  };
}

describe('FindSheetComponent', () => {
  it('shows the species, the line, the badge and the note in the body', async () => {
    const setup = await build();

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026 · 3 Stück · Frederik')).toBeInTheDocument();
    expect(screen.getByText('geteilt')).toBeInTheDocument();
    expect(screen.getByText(FIND.note ?? '')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('saves a change and goes back to the view', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/finds/${FIND.id}`).flush(FIND);
    });

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    });
    expect(setup.toasts.success).toEqual(['Der Fund ist gespeichert.']);
  });

  it('stays in the form when the change fails', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/finds/${FIND.id}`).error(new ProgressEvent('error'));
    });

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    });
  });

  /** Answers each open request of the photo list. */
  async function answerPhotos(setup: Setup, ids: readonly string[]): Promise<void> {
    await vi.waitFor(() => {
      const open = setup.http.match((request) => request.url === '/api/photos' && request.method === 'GET');
      expect(open.length).toBeGreaterThan(0);
      for (const request of open) {
        request.flush({ items: ids.map((id) => ({ id })), nextCursor: null });
      }
    });
  }

  it('removes a photo and gets the list again', async () => {
    const setup = await build();
    await answerPhotos(setup, ['foto-eins']);

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Bild entfernen' }));

    await vi.waitFor(() => {
      setup.http.expectOne('/api/photos/foto-eins').flush(null);
    });
    await answerPhotos(setup, []);
  });

  it('uploads a photo that the edit adds, and gets the list again', async () => {
    const setup = await build();
    await answerPhotos(setup, []);

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    const input = setup.container.querySelector('input[type=file]');
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
    await userEvent.upload(input, new File(['bild'], 'pilz.jpg', { type: 'image/jpeg' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/finds/${FIND.id}`).flush(FIND);
    });
    await vi.waitFor(() => {
      const upload = setup.http.expectOne({ url: '/api/photos', method: 'POST' });
      expect((upload.request.body as FormData).get('findId')).toBe(FIND.id);
      upload.flush({ id: 'foto-neu' });
    });
    await answerPhotos(setup, ['foto-neu']);

    expect(setup.toasts.success).toEqual(['Gespeichert.']);
  });

  it('says so when the find is saved but a new photo fails', async () => {
    const setup = await build();
    await answerPhotos(setup, []);

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    const input = setup.container.querySelector('input[type=file]');
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
    await userEvent.upload(input, new File(['bild'], 'pilz.jpg', { type: 'image/jpeg' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/finds/${FIND.id}`).flush(FIND);
    });
    await vi.waitFor(() => {
      setup.http
        .expectOne({ url: '/api/photos', method: 'POST' })
        .flush(null, { status: 500, statusText: 'Server Error' });
    });

    await vi.waitFor(() => {
      expect(setup.toasts.failure).toContain('Gespeichert, aber ein Foto ließ sich nicht hochladen.');
    });
  });

  it('asks before the delete and closes before the answer', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Fund löschen?' })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    expect(setup.closed).toBe(1);
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/finds/${FIND.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.toasts.success).not.toHaveLength(0);
    });
    expect(setup.toasts.success).toEqual(['Der Fund ist gelöscht.']);
  });

  it('closes the question without a delete', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    setup.refresh();

    setup.http.expectNone(`/api/finds/${FIND.id}`);
    expect(setup.closed).toBe(0);
  });
});
