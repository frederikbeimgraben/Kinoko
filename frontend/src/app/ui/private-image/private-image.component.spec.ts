import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { PrivateImageComponent } from './private-image.component';

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

  async function build(path: string): Promise<Setup> {
    const { container, detectChanges } = await render(PrivateImageComponent, {
      inputs: { path, alt: 'Aufnahme von Steinpilz' },
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

  it('bleibt leer, wenn die Datei nicht kommt', async () => {
    const { container, http, refresh } = await build('/api/species-images/bild-eins/thumb');

    http
      .expectOne('/api/species-images/bild-eins/thumb')
      .error(new ProgressEvent('error'), { status: 404, statusText: 'Not Found' });
    refresh();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await noViolations(container);
  });
});
