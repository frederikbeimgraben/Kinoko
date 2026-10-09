import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { MARKER, MARKER_ENTRY } from '../../testing/entries-fixture';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { MarkerSheetComponent } from './marker-sheet.component';
import { ObjectSheetStore } from './object-sheet.store';

interface Setup {
  container: Element;
  closed: number;
  http: HttpTestingController;
  toasts: ToastSpy;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  const { container, detectChanges, fixture } = await render(MarkerSheetComponent, {
    inputs: { marker: MARKER },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  let closed = 0;
  fixture.componentInstance.closed.subscribe(() => (closed += 1));
  return {
    container,
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpy(),
    refresh: detectChanges,
    get closed() {
      return closed;
    },
  };
}

/** Goes from the sheet to the marker form. */
async function edit(setup: Setup): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
  setup.refresh();
}

describe('MarkerBlattComponent', () => {
  it('zeigt Name, Sichtbarkeit und Notiz im Rumpf', async () => {
    const setup = await build();

    expect(screen.getByText('Alter Fichtenhang')).toBeInTheDocument();
    expect(screen.getByText('Marker · 1. September 2026 · privat')).toBeInTheDocument();
    expect(screen.getByText('Nordhang, ab Mitte September.')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('füllt das Formular aus dem Marker', async () => {
    const setup = await build();

    await edit(setup);

    expect(screen.getByRole('button', { name: /Ort/ })).toHaveTextContent('48,5300 · 9,0600');
    expect(screen.getByLabelText('Name')).toHaveValue('Alter Fichtenhang');
    expect(screen.getByRole('button', { name: 'Violett' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Notiz')).toHaveValue('Nordhang, ab Mitte September.');
    expect(screen.queryByText('Sichtbarkeit')).not.toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('speichert eine Änderung', async () => {
    const setup = await build();
    await edit(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Rot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/markers/${MARKER.id}`));
    expect(request.request.body).toMatchObject({ colour: 'red', lat: MARKER.lat, lon: MARKER.lon });
    request.flush(MARKER_ENTRY);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Der Marker ist gespeichert.']);
    });
  });

  it('trägt im Formular keinen Abbrechen-Knopf: das X des Blatts bricht ab', async () => {
    const setup = await build();
    await edit(setup);

    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
    setup.http.expectNone(`/api/marker/${MARKER.id}`);
  });

  it('führt den Marker an die Karten-App weiter', async () => {
    await build();
    const fakeLocation = { href: '' } as unknown as Location;
    vi.spyOn(window, 'location', 'get').mockReturnValue(fakeLocation);

    await userEvent.click(screen.getByRole('button', { name: 'In Karten-App öffnen' }));

    expect(fakeLocation.href).toBe(`geo:${MARKER.lat.toFixed(6)},${MARKER.lon.toFixed(6)}`);
  });

  it('speichert den neuen Ort aus dem Fadenkreuz', async () => {
    const setup = await build();
    await edit(setup);

    await userEvent.click(screen.getByRole('button', { name: /Ort/ }));
    const sheet = TestBed.inject(ObjectSheetStore);
    expect(sheet.relocating()).toBe(true);
    sheet.relocate([9.2, 48.6]);
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    const request = await vi.waitFor(() => setup.http.expectOne(`/api/markers/${MARKER.id}`));
    expect(request.request.body).toMatchObject({ lat: 48.6, lon: 9.2 });
  });

  it('schließt beim Löschen sofort und meldet es danach', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    expect(setup.closed).toBe(1);
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/markers/${MARKER.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Der Marker ist gelöscht.']);
    });
  });
});
