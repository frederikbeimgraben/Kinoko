import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { PrivateImageComponent, isLight } from './private-image.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  refresh: () => void;
}

describe('PrivateImageComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:eins',
      revokeObjectURL: () => undefined,
    });
  });

  async function build(path: string, fit?: 'cover' | 'contain' | 'natural'): Promise<Setup> {
    const { container, detectChanges } = await render(PrivateImageComponent, {
      inputs: { path, alt: 'Aufnahme von Steinpilz', ...(fit ? { fit } : {}) },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return { container, http: TestBed.inject(HttpTestingController), refresh: detectChanges };
  }

  it('holt die Datei über den angemeldeten Weg und zeigt sie', async () => {
    const { container, http, refresh } = await build('/api/species-images/bild-eins/thumb');

    const request = http.expectOne('/api/species-images/bild-eins/thumb');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));

    await vi.waitFor(() => {
      refresh();
      expect(screen.getByRole('img', { name: 'Aufnahme von Steinpilz' })).toHaveAttribute('src', 'blob:eins');
    });
    await noViolations(container);
  });

  it('shows a shimmering skeleton area until the file comes', async () => {
    const { container, http, refresh } = await build('/api/species-images/bild-eins/thumb');
    refresh();

    expect(container).toHaveClass('private--loading', 'motion-shimmer');

    http.expectOne('/api/species-images/bild-eins/thumb').flush(new Blob(['x'], { type: 'image/jpeg' }));
    await vi.waitFor(() => {
      refresh();
      expect(container).not.toHaveClass('private--loading');
    });
  });

  it('bleibt leer, wenn die Datei nicht kommt', async () => {
    const { container, http, refresh } = await build('/api/species-images/bild-eins/thumb');

    http
      .expectOne('/api/species-images/bild-eins/thumb')
      .error(new ProgressEvent('error'), { status: 404, statusText: 'Not Found' });
    refresh();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('überlässt die Höhe dem Seitenverhältnis, wenn `fit` auf `natural` steht', async () => {
    const { container, http, refresh } = await build('/api/photos/bild-eins/full', 'natural');

    http.expectOne('/api/photos/bild-eins/full').flush(new Blob(['x'], { type: 'image/jpeg' }));

    await vi.waitFor(() => {
      refresh();
      expect(screen.getByRole('img', { name: 'Aufnahme von Steinpilz' })).toHaveClass(
        'private__image--natural',
      );
    });
    await noViolations(container);
  });

  it('zeigt ohne Weg das Ersatzsymbol auf Farbe, per `kit.css` `.sq`', async () => {
    const { container } = await render(PrivateImageComponent, {
      inputs: { alt: 'Steinpilz', colour: '#7a5230', icon: 'mushroom' },
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const fallback = container.querySelector<HTMLElement>('.private__fallback');
    expect(fallback).toHaveStyle({ background: 'rgb(122, 82, 48)' });
    await noViolations(container);
  });

  it('trägt dunkle Tinte auf hellem Ersatzgrund', async () => {
    const { container } = await render(PrivateImageComponent, {
      inputs: { alt: 'Pfifferling', colour: '#e3b341', ink: 'dark' },
    });

    expect(container.querySelector('.private__fallback')).toHaveClass('private__fallback--dark');
  });

  it('wählt die Tinte nach der Helligkeit des Grundes', async () => {
    const { container, rerender } = await render(PrivateImageComponent, {
      inputs: { alt: 'Steinpilz', colour: '#f3efe6' },
    });

    expect(container.querySelector('.private__fallback')).toHaveClass('private__fallback--dark');
    await rerender({ inputs: { alt: 'Steinpilz', colour: '#7a5230' } });
    expect(container.querySelector('.private__fallback')).not.toHaveClass('private__fallback--dark');
  });

  it('zeigt ohne Bild im Kopf das große Umrisssymbol auf dem Grund des Kopfes', async () => {
    const { container } = await render(PrivateImageComponent, {
      inputs: { alt: 'Steinpilz', fallback: 'hero' },
    });

    expect(container.querySelector('.private__fallback--hero app-svg-icon svg')).toHaveAttribute(
      'width',
      '96',
    );
  });
});

describe('isLight', () => {
  it('nennt Weiß und Creme hell, Braun und Unlesbares dunkel', () => {
    expect(isLight('#f3efe6')).toBe(true);
    expect(isLight('#e8d9b5')).toBe(true);
    expect(isLight('#7a5230')).toBe(false);
    expect(isLight('kein Wert')).toBe(false);
  });
});
