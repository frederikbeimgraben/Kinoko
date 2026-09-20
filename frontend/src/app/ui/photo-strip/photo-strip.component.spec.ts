import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { PhotoStripComponent } from './photo-strip.component';

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

describe('PhotoStripComponent im Modus edit', () => {
  it('zeigt eine Kachel je neue Datei', async () => {
    stubUrls();
    const { container } = await render(PhotoStripComponent, {
      inputs: { mode: 'edit', pending: [FILE_A, FILE_B] },
    });

    expect(container.querySelectorAll('.pht__image')).toHaveLength(2);
    await noViolations(container);
  });

  it('zeigt vorhandene Fotos und meldet, welches weg soll', async () => {
    stubUrls();
    const { fixture } = await render(PhotoStripComponent, {
      inputs: { mode: 'edit', photos: [{ id: 'foto-eins', path: '/api/photos/foto-eins/list' }] },
    });
    const removed: string[] = [];
    fixture.componentInstance.removed.subscribe((id) => removed.push(id));

    await userEvent.click(screen.getByRole('button', { name: 'Bild entfernen' }));

    expect(removed).toEqual(['foto-eins']);
  });

  it('hängt neu gewählte Dateien an', async () => {
    stubUrls();
    const { fixture } = await render(PhotoStripComponent, {
      inputs: { mode: 'edit', pending: [FILE_A] },
    });
    const changes: (readonly File[])[] = [];
    fixture.componentInstance.pendingChange.subscribe((value) => changes.push(value));

    const input = screen.getByLabelText('Bild hinzufügen', { selector: 'input' });
    await userEvent.upload(input, FILE_B);

    expect(changes.at(-1)).toEqual([FILE_A, FILE_B]);
  });

  it('kappt eine Auswahl an der freien Kachelzahl', async () => {
    stubUrls();
    const { fixture } = await render(PhotoStripComponent, {
      inputs: { mode: 'edit', pending: [FILE_A, FILE_B] },
    });
    const changes: (readonly File[])[] = [];
    fixture.componentInstance.pendingChange.subscribe((value) => changes.push(value));

    const input = screen.getByLabelText('Bild hinzufügen', { selector: 'input' });
    await userEvent.upload(input, [FILE_C, FILE_D]);

    expect(changes.at(-1)).toEqual([FILE_A, FILE_B, FILE_C]);
  });

  it('blendet die Hinzufügen-Kachel bei drei Bildern aus', async () => {
    stubUrls();
    const { container } = await render(PhotoStripComponent, {
      inputs: { mode: 'edit', pending: [FILE_A, FILE_B, FILE_C] },
    });

    expect(container.querySelector('.pht--add')).toBeNull();
  });

  it('gibt beim Zerstören jede Objekt-URL frei', async () => {
    const { revoked } = stubUrls();
    const { fixture } = await render(PhotoStripComponent, {
      inputs: { mode: 'edit', pending: [FILE_A, FILE_B] },
    });

    fixture.destroy();

    expect(revoked.sort()).toEqual(['blob:0', 'blob:1']);
  });

  it('blendet den Entfernen-Knopf aus, wo nichts entfernt werden darf', async () => {
    stubUrls();
    const { container } = await render(PhotoStripComponent, {
      inputs: {
        mode: 'edit',
        photos: [{ id: 'foto-eins', path: '/api/photos/foto-eins/list' }],
        removable: false,
      },
    });

    expect(container.querySelector('.pht__remove')).toBeNull();
  });
});

describe('PhotoStripComponent im Modus view', () => {
  it('meldet, welches Bild angetippt wurde', async () => {
    const { fixture } = await render(PhotoStripComponent, {
      inputs: {
        mode: 'view',
        photos: [
          { id: 'foto-eins', path: '/api/photos/foto-eins/list' },
          { id: 'foto-zwei', path: '/api/photos/foto-zwei/list', lead: true },
        ],
      },
    });
    const opened: number[] = [];
    fixture.componentInstance.opened.subscribe((index) => opened.push(index));

    await userEvent.click(screen.getByRole('button', { name: 'Foto 2' }));

    expect(opened).toEqual([1]);
  });

  it('trägt das Titelbild-Zeichen an der richtigen Kachel', async () => {
    const { container } = await render(PhotoStripComponent, {
      inputs: {
        mode: 'view',
        photos: [
          { id: 'foto-eins', path: '/api/photos/foto-eins/list' },
          { id: 'foto-zwei', path: '/api/photos/foto-zwei/list', lead: true },
        ],
      },
    });

    const tiles = container.querySelectorAll('.pht');
    expect(tiles[0].querySelector('.pht__lead')).toBeNull();
    expect(tiles[1].querySelector('.pht__lead')).not.toBeNull();
  });

  it('zeigt im Modus view keine Hinzufügen-Kachel', async () => {
    const { container } = await render(PhotoStripComponent, {
      inputs: { mode: 'view', photos: [{ id: 'foto-eins', path: '/api/photos/foto-eins/list' }] },
    });

    expect(container.querySelector('.pht--add')).toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(PhotoStripComponent, {
      inputs: { mode: 'view', photos: [{ id: 'foto-eins', path: '/api/photos/foto-eins/list' }] },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
