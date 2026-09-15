import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Provider } from '@angular/core';
import { render, screen, type RenderResult } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { I18nService } from '../../core/i18n/i18n.service';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { photo } from '../../testing/photos-fixture';
import type { Photo } from '../../core/api/models';
import { ImageViewerComponent } from './image-viewer.component';

const FULL_PATH = '/api/photos/bild-eins/full';

/** Der Zurück-Knopf im Kopf der Seite trägt nur seinen Namen. */
function backLabel(): string {
  return TestBed.inject(I18nService).translate('common.back');
}

async function build(
  image: Photo | null,
  title = 'Steinpilz',
  extra: Provider[] = [],
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

  it('bleibt ohne Bild leer', async () => {
    const { container } = await build(null);

    expect(container.querySelector('app-page-header')).toBeNull();
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

  it('nennt die Quelle, wenn eine dasteht', async () => {
    await build(photo({ source: '123pilzsuche.de' }));

    expect(screen.getByText('123pilzsuche.de')).toBeInTheDocument();
  });

  it('lässt weg, was das Bild nicht hat', async () => {
    await build(photo({ takenOn: null }));

    expect(screen.queryByText('Aufgenommen')).not.toBeInTheDocument();
  });

  it('nimmt den Namen der Art als Bildbeschreibung, wenn keine Unterschrift dasteht', async () => {
    await build(photo());

    expect(screen.getByRole('img', { name: 'Steinpilz' })).toBeInTheDocument();
  });

  it('meldet den Weg zurück nach draussen', async () => {
    const { fixture } = await build(photo());
    let calls = 0;
    fixture.componentInstance.back.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: backLabel() }));

    expect(calls).toBe(1);
  });

  it('zeigt den Zähler, sobald eine Anzahl dasteht', async () => {
    await render(ImageViewerComponent, {
      inputs: { image: photo(), title: 'Steinpilz', index: 2, count: 4 },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    expect(screen.getByText('2 von 4')).toBeInTheDocument();
  });

  it('nennt am Ort, dass er gerundet ist', async () => {
    await build(photo({ lat: 48.51, lon: 9.06 }));

    expect(screen.getByText('48,51 · 9,06 · 1 km')).toBeInTheDocument();
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
