import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { FIND } from '../../testing/entries-fixture';
import { photo } from '../../testing/photos-fixture';
import { PhotoGalleryComponent } from './photo-gallery.component';

const LIST = `/api/photos?findId=${FIND.id}`;
const SHOT = photo({ id: 'bild-eins', findId: FIND.id, speciesId: null });

function build(): ReturnType<typeof render<PhotoGalleryComponent>> {
  return render(PhotoGalleryComponent, {
    inputs: { findId: FIND.id },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
}

describe('FotoGalerieComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:foto', revokeObjectURL: () => undefined });
  });

  it('holt die Fotos des Fundes und zeigt sie', async () => {
    const { container, detectChanges } = await build();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(LIST).flush({ items: [SHOT], nextCursor: null });
    await vi.waitFor(() => {
      detectChanges();
      http.expectOne(`/api/photos/${SHOT.id}/list`).flush(new Blob(['bild']));
    });

    await vi.waitFor(() => {
      detectChanges();
      expect(screen.getByRole('img', { name: 'Foto 1' })).toBeInTheDocument();
    });

    await noViolations(container);
  });

  it('zeigt nichts, wenn der Fund keine Fotos trägt', async () => {
    const { detectChanges } = await build();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(LIST).flush({ items: [], nextCursor: null });

    await vi.waitFor(() => {
      detectChanges();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
    http.verify();
  });
});
