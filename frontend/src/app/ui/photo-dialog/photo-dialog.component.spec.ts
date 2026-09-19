import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen, type RenderResult } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import type { Photo } from '../../core/api/models';
import { photo } from '../../testing/photos-fixture';
import { PhotoDialogComponent } from './photo-dialog.component';

const PHOTOS: readonly Photo[] = [
  photo({ id: 'bild-eins' }),
  photo({ id: 'bild-zwei' }),
  photo({ id: 'bild-drei' }),
];

function build(photos: readonly Photo[] = PHOTOS, index = 0): Promise<RenderResult<PhotoDialogComponent>> {
  return render(PhotoDialogComponent, {
    inputs: { photos, index },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
}

/** Beantwortet den Abruf des grossen Bildes und wartet auf die Kachel. */
async function settle(detectChanges: () => void, id: string): Promise<void> {
  const http = TestBed.inject(HttpTestingController);
  await vi.waitFor(() => {
    detectChanges();
    http.expectOne(`/api/photos/${id}/full`).flush(new Blob(['bild']));
  });
  detectChanges();
}

describe('PhotoDialogComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:foto', revokeObjectURL: () => undefined });
  });

  it('zeigt das Foto des Index über dem Blatt', async () => {
    const { container, detectChanges } = await build(PHOTOS, 1);

    await settle(detectChanges, 'bild-zwei');

    expect(screen.getByRole('dialog', { name: 'Foto 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto 2' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('schließt über das X', async () => {
    const { fixture } = await build();
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(calls).toBe(1);
  });

  it('schließt über Escape', async () => {
    const { fixture } = await build();
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('schließt über einen Tipp auf den Grund', async () => {
    const { fixture } = await build();
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('dialog'));

    expect(calls).toBe(1);
  });

  it('bleibt offen bei einem Tipp auf das Foto', async () => {
    const { fixture, detectChanges } = await build();
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));
    await settle(detectChanges, 'bild-eins');

    await userEvent.click(screen.getByRole('img', { name: 'Foto 1' }));

    expect(calls).toBe(0);
  });

  it('wechselt mit den Pfeiltasten zum nächsten und zum vorigen Foto', async () => {
    const { detectChanges } = await build();
    await settle(detectChanges, 'bild-eins');

    await userEvent.keyboard('{ArrowRight}');
    await settle(detectChanges, 'bild-zwei');
    expect(screen.getByRole('img', { name: 'Foto 2' })).toBeInTheDocument();

    await userEvent.keyboard('{ArrowLeft}');
    await settle(detectChanges, 'bild-eins');
    expect(screen.getByRole('img', { name: 'Foto 1' })).toBeInTheDocument();
  });

  it('wechselt mit den Pfeilknöpfen das Foto', async () => {
    const { detectChanges } = await build();
    await settle(detectChanges, 'bild-eins');

    await userEvent.click(screen.getByRole('button', { name: 'Nächstes Bild' }));
    await settle(detectChanges, 'bild-zwei');

    expect(screen.getByRole('img', { name: 'Foto 2' })).toBeInTheDocument();
  });

  it('wechselt mit einem Wisch nach links zum nächsten Foto', async () => {
    const { detectChanges } = await build();
    await settle(detectChanges, 'bild-eins');
    const image = screen.getByRole('img', { name: 'Foto 1' });

    image.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 300 }));
    image.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 100 }));
    await settle(detectChanges, 'bild-zwei');

    expect(screen.getByRole('img', { name: 'Foto 2' })).toBeInTheDocument();
  });

  it('führt vom ersten Foto zum letzten zurück', async () => {
    const { detectChanges } = await build(PHOTOS, 0);
    await settle(detectChanges, 'bild-eins');

    await userEvent.keyboard('{ArrowLeft}');
    await settle(detectChanges, 'bild-drei');

    expect(screen.getByRole('img', { name: 'Foto 3' })).toBeInTheDocument();
  });

  it('zeigt keine Pfeile bei genau einem Foto', async () => {
    const { detectChanges } = await build([photo({ id: 'bild-eins' })]);
    await settle(detectChanges, 'bild-eins');

    expect(screen.queryByRole('button', { name: 'Nächstes Bild' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voriges Bild' })).not.toBeInTheDocument();
  });

  it('bleibt leer ohne Fotos', async () => {
    await build([]);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
