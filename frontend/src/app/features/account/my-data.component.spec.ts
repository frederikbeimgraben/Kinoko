import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { OfflineStoreDouble, offlineProvider } from '../../testing/offline-double';
import { ANY_ROUTE } from '../../testing/routes';
import { SyncStub, syncStubProviders } from '../../testing/sync-double';
import { toastSpy } from '../../testing/toast-spy';
import { MyDataComponent } from './my-data.component';

const EXPORT = {
  me: { id: 'account-one', sub: 'sub', email: 'a@b.de', name: 'Frederik' },
  finds: [
    {
      id: 'find-1',
      lat: 48.5,
      lon: 9.05,
      foundOn: '2026-09-06',
      updatedAt: '2026-09-06T08:00:00Z',
      deleted: false,
    },
    {
      id: 'find-2',
      lat: 48.6,
      lon: 9.1,
      foundOn: '2026-09-07',
      updatedAt: '2026-09-07T08:00:00Z',
      deleted: false,
    },
  ],
  markers: [{}, {}, {}, {}],
  zones: [],
  combinations: [{}, {}, {}],
  photos: [{}],
};

interface Setup {
  container: Element;
  http: HttpTestingController;
  offline: OfflineStoreDouble;
  router: Router;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:one',
    revokeObjectURL: () => undefined,
  });
  const offline = new OfflineStoreDouble();
  const { container, detectChanges } = await render(MyDataComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter(ANY_ROUTE),
      ...authStubProviders(new AuthStub()),
      ...syncStubProviders(new SyncStub()),
      offlineProvider(offline),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  await vi.waitFor(() => {
    http.expectOne('/api/me/export').flush(EXPORT);
  });
  detectChanges();
  return { container, http, offline, router: TestBed.inject(Router), refresh: detectChanges };
}

/** Catches the file that the export hands to the browser. */
function catchDownload(): { name: () => string } {
  let name = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    name = this.download;
  });
  return { name: () => name };
}

describe('MyDataComponent', () => {
  it('shows four count tiles from the export', async () => {
    const { container } = await build();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('Kombinationen')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('exports JSON from the sheet', async () => {
    const download = catchDownload();
    const { refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Daten exportieren' }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }));

    expect(download.name()).toMatch(/^kinoko-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('exports GPX without images and combinations', async () => {
    const download = catchDownload();
    const { refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Daten exportieren' }));
    refresh();
    await userEvent.click(screen.getByRole('tab', { name: 'GPX' }));
    refresh();
    const sheet = screen.getByRole('dialog');

    expect(within(sheet).getByRole('checkbox', { name: /Bilder/ })).toBeDisabled();
    expect(within(sheet).getByRole('checkbox', { name: /Funde/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }));

    expect(download.name()).toMatch(/\.gpx$/);
  });

  it('deletes all data after the question, clears the queue and goes back', async () => {
    const { http, offline, router } = await build();
    await offline.put('queue', 'task', {});
    const change = vi.spyOn(router, 'navigateByUrl');
    const spy = toastSpy();

    await userEvent.click(screen.getByRole('button', { name: 'Alles löschen' }));
    expect(screen.getByText('2 Funde · 4 Marker · 0 Zonen · 1 Bilder')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Alles löschen' }));
    http.expectOne('/api/me/data').flush(null, { status: 204, statusText: 'No Content' });

    await vi.waitFor(() => {
      expect(change).toHaveBeenCalledWith('/konto');
    });
    expect(await offline.all('queue')).toEqual([]);
    expect(spy.success).toEqual(['Alle Daten gelöscht']);
  });
});
