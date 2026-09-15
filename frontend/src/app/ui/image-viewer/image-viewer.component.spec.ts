import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen, type RenderResult } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { I18nService } from '../../core/i18n/i18n.service';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { photo } from '../../testing/photos-fixture';
import type { Photo } from '../../core/api/models';
import { ImageViewerComponent } from './image-viewer.component';

const FULL_PATH = '/api/photos/bild-eins/full';

/** Der Dialog des Kits beschriftet seinen eigenen Schließen-Knopf. */
function closeLabel(): string {
  return TestBed.inject(I18nService).translate('common.close');
}

async function build(
  image: Photo | null,
  title = 'Steinpilz',
  extra: unknown[] = [],
): Promise<RenderResult<ImageViewerComponent>> {
  const result = await render(ImageViewerComponent, {
    inputs: { image, title },
    providers: [provideHttpClient(), provideHttpClientTesting(), ...extra],
  });
  const http = TestBed.inject(HttpTestingController);
  for (const request of http.match(FULL_PATH)) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
  result.detectChanges();
  return result;
}

describe('ImageViewerComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:eins', revokeObjectURL: () => undefined });
  });

  it('bleibt ohne Bild zu', async () => {
    await build(null);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('zeigt das Bild gross mit Fotograf, Lizenz und Aufnahmetag', async () => {
    const { container } = await build(photo({ caption: 'Junges Exemplar' }));

    expect(screen.getByRole('img', { name: 'Junges Exemplar' })).toBeInTheDocument();
    expect(screen.getByText('Marie Weber')).toBeInTheDocument();
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026')).toBeInTheDocument();
    expect(screen.getByText('Junges Exemplar')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt weg, was das Bild nicht hat', async () => {
    await build(photo({ takenOn: null }));

    expect(screen.queryByText('Aufgenommen')).not.toBeInTheDocument();
  });

  it('nimmt den Namen der Art als Bildbeschreibung, wenn keine Unterschrift dasteht', async () => {
    await build(photo());

    expect(screen.getByRole('img', { name: 'Steinpilz' })).toBeInTheDocument();
  });

  it('meldet das Schliessen nach draussen', async () => {
    const { fixture } = await build(photo());
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: closeLabel() }));

    expect(calls).toBe(1);
  });

  it('schliesst mit Escape', async () => {
    const { fixture } = await build(photo());
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('nennt am Ort, dass er gerundet ist', async () => {
    await build(photo({ lat: 48.51, lon: 9.06 }));

    expect(screen.getByText('48,51 · 9,06, 5 km')).toBeInTheDocument();
  });

  it('lässt den Ort weg, wenn das Bild keinen trägt', async () => {
    await build(photo());

    expect(screen.queryByText(/km$/)).not.toBeInTheDocument();
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await build(photo({ caption: 'test caption' }), 'Species', [EMPTY_CATALOG]);

    noGermanText(container);
  });
});
