import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { FIND } from '../../testing/entries-fixture';
import { photo } from '../../testing/photos-fixture';
import { PhotoGalleryComponent } from './photo-gallery.component';

const LIST = `/api/photos?findId=${FIND.id}`;
const SHOT = photo({ id: 'bild-eins', findId: FIND.id, speciesId: null });
const SECOND = photo({ id: 'bild-zwei', findId: FIND.id, speciesId: null });

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

  it('öffnet das Foto als Dialog und gibt den Fokus an die Kachel zurück', async () => {
    const { detectChanges } = await build();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(LIST).flush({ items: [SHOT, SECOND], nextCursor: null });
    await vi.waitFor(() => {
      detectChanges();
      http.expectOne(`/api/photos/${SHOT.id}/list`).flush(new Blob(['bild']));
      http.expectOne(`/api/photos/${SECOND.id}/list`).flush(new Blob(['bild']));
    });
    detectChanges();

    const tile = screen.getByRole('button', { name: 'Foto 1' });
    await userEvent.click(tile);
    await vi.waitFor(() => {
      detectChanges();
      http.expectOne(`/api/photos/${SHOT.id}/full`).flush(new Blob(['bild']));
    });
    detectChanges();
    expect(screen.getByRole('dialog', { name: 'Foto 1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    await vi.waitFor(() => {
      detectChanges();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(tile).toHaveFocus();
    });
  });

  it('zeigt nichts, wenn die Liste der Fotos nicht kommt', async () => {
    const { detectChanges } = await build();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(LIST).flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });

    await vi.waitFor(() => {
      detectChanges();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
    http.verify();
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
