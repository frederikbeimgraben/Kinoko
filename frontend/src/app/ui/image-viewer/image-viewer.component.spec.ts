import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { I18nService } from '../../core/i18n/i18n.service';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesImage } from '../../testing/species-images-fixture';
import { ImageViewerComponent } from './image-viewer.component';

/** Der Dialog des Kits beschriftet seinen eigenen Schließen-Knopf. */
function closeLabel(): string {
  return TestBed.inject(I18nService).translate('common.close');
}

describe('ImageViewerComponent', () => {
  it('bleibt ohne Bild zu', async () => {
    await render(ImageViewerComponent, { inputs: { image: null, title: 'Steinpilz' } });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('zeigt das Bild gross mit Fotograf, Lizenz und Aufnahmetag', async () => {
    const { container } = await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ caption: 'Junges Exemplar' }), title: 'Steinpilz' },
    });

    const image = screen.getByRole('img', { name: 'Junges Exemplar' });
    expect(image).toHaveAttribute('src', '/api/species-images/bild-eins/full');
    expect(screen.getByText('Marie Weber')).toBeInTheDocument();
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026')).toBeInTheDocument();
    expect(screen.getByText('Junges Exemplar')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt weg, was das Bild nicht hat', async () => {
    await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ takenOn: null, source: null }), title: 'Steinpilz' },
    });

    expect(screen.queryByText('Aufgenommen')).not.toBeInTheDocument();
    expect(screen.queryByText('Quelle')).not.toBeInTheDocument();
  });

  it('nennt die Quelle, wenn eine dabei ist', async () => {
    await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ source: 'https://example.test/pilz' }), title: 'Steinpilz' },
    });

    expect(screen.getByText('https://example.test/pilz')).toBeInTheDocument();
  });

  it('nimmt den Namen der Art als Bildbeschreibung, wenn keine Unterschrift dasteht', async () => {
    await render(ImageViewerComponent, { inputs: { image: speciesImage(), title: 'Steinpilz' } });

    expect(screen.getByRole('img', { name: 'Steinpilz' })).toBeInTheDocument();
  });

  it('meldet das Schliessen nach draussen', async () => {
    const { fixture } = await render(ImageViewerComponent, {
      inputs: { image: speciesImage(), title: 'Steinpilz' },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: closeLabel() }));

    expect(calls).toBe(1);
  });

  it('schliesst mit Escape', async () => {
    const { fixture } = await render(ImageViewerComponent, {
      inputs: { image: speciesImage(), title: 'Steinpilz' },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('nennt am Ort, dass er gerundet ist', async () => {
    await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ lat: 48.51, lon: 9.06 }), title: 'Steinpilz' },
    });

    expect(screen.getByText('48,51 · 9,06, 5 km')).toBeInTheDocument();
  });

  it('lässt den Ort weg, wenn das Bild keinen trägt', async () => {
    await render(ImageViewerComponent, {
      inputs: { image: speciesImage(), title: 'Steinpilz' },
    });

    expect(screen.queryByText(/km$/)).not.toBeInTheDocument();
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ caption: 'test caption' }), title: 'Species' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
