import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { PhotoPickerComponent } from './photo-picker.component';

const FILE_A = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
const FILE_B = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
const FILE_C = new File(['c'], 'c.jpg', { type: 'image/jpeg' });
const FILE_D = new File(['d'], 'd.jpg', { type: 'image/jpeg' });

function stubUrls(): { revoked: string[] } {
  let next = 0;
  const revoked: string[] = [];
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => `blob:${String(next++)}`,
    revokeObjectURL: (url: string) => revoked.push(url),
  });
  return { revoked };
}

describe('PhotoPickerComponent', () => {
  it('zeigt eine Kachel je Bild mit Vorschau', async () => {
    stubUrls();
    const { container } = await render(PhotoPickerComponent, {
      inputs: { files: [FILE_A, FILE_B] },
    });

    expect(container.querySelectorAll('.tile__image')).toHaveLength(2);
    await noViolations(container);
  });

  it('hängt neu gewählte Dateien an', async () => {
    stubUrls();
    const { fixture } = await render(PhotoPickerComponent, {
      inputs: { files: [FILE_A] },
    });
    const changes: (readonly File[])[] = [];
    fixture.componentInstance.filesChange.subscribe((value) => changes.push(value));

    const input = screen.getByLabelText('Bild hinzufügen', { selector: 'input' });
    await userEvent.upload(input, FILE_B);

    expect(changes.at(-1)).toEqual([FILE_A, FILE_B]);
  });

  it('kappt eine Auswahl an der freien Kachelzahl', async () => {
    stubUrls();
    const { fixture } = await render(PhotoPickerComponent, {
      inputs: { files: [FILE_A, FILE_B] },
    });
    const changes: (readonly File[])[] = [];
    fixture.componentInstance.filesChange.subscribe((value) => changes.push(value));

    const input = screen.getByLabelText('Bild hinzufügen', { selector: 'input' });
    await userEvent.upload(input, [FILE_C, FILE_D]);

    expect(changes.at(-1)).toEqual([FILE_A, FILE_B, FILE_C]);
  });

  it('blendet die Hinzufügen-Kachel bei drei Bildern aus', async () => {
    stubUrls();
    const { container } = await render(PhotoPickerComponent, {
      inputs: { files: [FILE_A, FILE_B, FILE_C] },
    });

    expect(container.querySelector('.tile--add')).toBeNull();
  });

  it('entfernt ein Bild über den X-Knopf und gibt die Objekt-URL frei', async () => {
    const { revoked } = stubUrls();
    const { fixture } = await render(PhotoPickerComponent, {
      inputs: { files: [FILE_A, FILE_B] },
    });
    const changes: (readonly File[])[] = [];
    fixture.componentInstance.filesChange.subscribe((value) => changes.push(value));

    await userEvent.click(screen.getByRole('button', { name: 'Foto 1 entfernen' }));

    expect(changes).toEqual([[FILE_B]]);
    expect(revoked).toEqual(['blob:0']);
  });

  it('gibt beim Zerstören jede Objekt-URL frei', async () => {
    const { revoked } = stubUrls();
    const { fixture } = await render(PhotoPickerComponent, {
      inputs: { files: [FILE_A, FILE_B] },
    });

    fixture.destroy();

    expect(revoked.sort()).toEqual(['blob:0', 'blob:1']);
  });

  it('trägt den Druckzustand an der Hinzufügen-Kachel', async () => {
    stubUrls();
    const { container } = await render(PhotoPickerComponent, {});

    const add = container.querySelector('.tile--add');
    expect(add).toHaveClass('tap');
    expect(add).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    stubUrls();
    const { container } = await render(PhotoPickerComponent, {
      inputs: { files: [FILE_A] },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
