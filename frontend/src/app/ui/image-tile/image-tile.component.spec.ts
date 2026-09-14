import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesImage } from '../../testing/species-images-fixture';
import { ImageTileComponent } from './image-tile.component';

describe('ImageTileComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:eins', revokeObjectURL: () => undefined });
  });

  function flush(http: HttpTestingController, path: string): void {
    http.expectOne(path).flush(new Blob(['x'], { type: 'image/jpeg' }));
  }

  it('zeigt Bild und Herkunft', async () => {
    const { container, detectChanges } = await render(ImageTileComponent, {
      inputs: { image: speciesImage() },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flush(TestBed.inject(HttpTestingController), '/species-images/bild-eins/thumb');
    detectChanges();

    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt die Titelbild-Marke nur, wenn das Bild führt', async () => {
    const { container, detectChanges } = await render(ImageTileComponent, {
      inputs: { image: speciesImage(), lead: true },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flush(TestBed.inject(HttpTestingController), '/species-images/bild-eins/thumb');
    detectChanges();

    expect(container.querySelector('.tile__badge')).not.toBeNull();
  });

  it('lässt die Marke ohne Führung weg', async () => {
    const { container, detectChanges } = await render(ImageTileComponent, {
      inputs: { image: speciesImage(), lead: false },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flush(TestBed.inject(HttpTestingController), '/species-images/bild-eins/thumb');
    detectChanges();

    expect(container.querySelector('.tile__badge')).toBeNull();
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container, detectChanges } = await render(ImageTileComponent, {
      inputs: { image: speciesImage({ photographer: 'Marie Weber', licence: 'cc0' }) },
      providers: [provideHttpClient(), provideHttpClientTesting(), EMPTY_CATALOG],
    });
    flush(TestBed.inject(HttpTestingController), '/species-images/bild-eins/thumb');
    detectChanges();

    noGermanText(container);
  });
});
