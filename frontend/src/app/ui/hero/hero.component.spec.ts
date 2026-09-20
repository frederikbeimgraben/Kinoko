import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { HeroComponent, type HeroPhoto } from './hero.component';

const FULL_PATH = '/api/photos/bild-eins/full';

const PHOTO: HeroPhoto = { path: FULL_PATH, photographer: 'Marie Weber', licence: 'cc_by_sa_4' };

/** Lässt das private Bild seine angefragte Datei bekommen. */
function flushImage(): void {
  const http = TestBed.inject(HttpTestingController);
  for (const request of http.match((req) => req.url.startsWith('/api/photos/'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
}

describe('HeroComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:eins', revokeObjectURL: () => undefined });
  });

  it('zeigt das Bild mit Herkunft und Zähler', async () => {
    const { container } = await render(HeroComponent, {
      inputs: { photo: PHOTO, alt: 'Steinpilz', index: 1, count: 4 },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flushImage();

    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
    expect(screen.getByText('1 von 4')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt ohne Foto ohne Herkunftszeile', async () => {
    const { container } = await render(HeroComponent, {
      inputs: { photo: null, alt: 'Steinpilz' },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('zeigt randlos ohne Herkunftszeile', async () => {
    const { container } = await render(HeroComponent, {
      inputs: { photo: PHOTO, alt: 'Steinpilz', bare: true },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flushImage();

    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelector('.herofig')).toHaveClass('herofig--bare');
  });

  it('zeigt den Pfeil nur an der Seite mit weiteren Bildern', async () => {
    const { container } = await render(HeroComponent, {
      inputs: { photo: PHOTO, alt: 'Steinpilz', index: 1, count: 4 },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flushImage();

    expect(container.querySelector('.heronav--l')).toBeNull();
    expect(container.querySelector('.heronav--r')).not.toBeNull();
  });

  it('lässt die Pfeile ganz weg, wenn das Blättern aus ist', async () => {
    const { container } = await render(HeroComponent, {
      inputs: { photo: PHOTO, alt: 'Steinpilz', index: 1, count: 4, nav: false },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flushImage();

    expect(container.querySelector('.heronav--l')).toBeNull();
    expect(container.querySelector('.heronav--r')).toBeNull();
  });

  it('meldet ein Antippen des Bildes', async () => {
    let opened = 0;
    await render(HeroComponent, {
      inputs: { photo: PHOTO, alt: 'Steinpilz' },
      providers: [provideHttpClient(), provideHttpClientTesting()],
      on: { opened: () => (opened += 1) },
    });
    flushImage();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(opened).toBe(1);
  });

  it('bleibt ohne Antippen fest, wenn es nicht interaktiv ist', async () => {
    const { container } = await render(HeroComponent, {
      inputs: { photo: PHOTO, alt: 'Steinpilz', interactive: false },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flushImage();

    expect(container.querySelector('button.hero__frame')).toBeNull();
  });

  it('meldet Vor und Zurück getrennt', async () => {
    let prev = 0;
    let next = 0;
    await render(HeroComponent, {
      inputs: { photo: PHOTO, alt: 'Steinpilz', index: 2, count: 4 },
      providers: [provideHttpClient(), provideHttpClientTesting()],
      on: { prev: () => (prev += 1), next: () => (next += 1) },
    });
    flushImage();

    await userEvent.click(screen.getByRole('button', { name: 'Voriges Bild' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nächstes Bild' }));

    expect(prev).toBe(1);
    expect(next).toBe(1);
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(HeroComponent, {
      inputs: {
        photo: { path: FULL_PATH, photographer: 'Marie Weber', licence: 'cc_by_sa_4' },
        alt: 'Penny bun',
        index: 1,
        count: 2,
      },
      providers: [provideHttpClient(), provideHttpClientTesting(), EMPTY_CATALOG],
    });
    flushImage();

    noGermanText(container);
  });
});
