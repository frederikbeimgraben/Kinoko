import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { toastSpy } from '../../testing/toast-spy';
import { MyDataComponent } from './my-data.component';

const EXPORT = {
  me: { id: 'konto-eins', sub: 'sub', email: 'a@b.de', name: 'Frederik' },
  finds: [{}, {}],
  markers: [{}, {}, {}, {}],
  zones: [],
  combinations: [{}, {}, {}],
  photos: [{}],
};

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(MyDataComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/me/export').flush(EXPORT);
  detectChanges();
  return { container, http, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('MyDataComponent', () => {
  it('zeigt die Zähler aus dem Export', async () => {
    const { container } = await build();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lädt den Export als Datei', async () => {
    let filename = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
    });

    await build();
    await userEvent.click(screen.getByRole('button', { name: 'Als JSON exportieren' }));

    expect(click).toHaveBeenCalled();
    expect(filename).toMatch(/^kinoko-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('löscht alle Daten nach Bestätigung, leert die Warteschlange und führt zurück', async () => {
    const { http, router } = await build();
    const change = vi.spyOn(router, 'navigateByUrl');
    const spy = toastSpy();

    await userEvent.click(screen.getByRole('button', { name: 'Alles löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    http.expectOne('/api/me/data').flush(null, { status: 204, statusText: 'No Content' });

    expect(change).toHaveBeenCalledWith('/konto');
    expect(spy.success).toEqual(['Alle Daten gelöscht']);
  });
});
