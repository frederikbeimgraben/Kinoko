import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FilterSheetComponent } from './filter-sheet.component';

const OPEN = { open: true, title: 'Filter', primaryLabel: 'Show 12 species' };

/** Die eigenen Knöpfe des Blatts, ohne Griff, Fuß und den Scrim des Wirts. */
function dialogButtons(): HTMLElement[] {
  return within(screen.getByRole('dialog'))
    .getAllByRole('button')
    .filter((button) => !button.classList.contains('sheet__handle'))
    .filter((button) => !button.classList.contains('btn'));
}

describe('FilterSheetComponent', () => {
  it('zeigt nichts, solange das Blatt zu ist', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, open: false },
    });

    expect(container.querySelector('.filtersheet')).toBeNull();
  });

  it('baut auf dem Blatt-Baustein auf und bringt keinen eigenen Rahmen mit', async () => {
    const { container } = await render(FilterSheetComponent, { inputs: OPEN });

    expect(container.querySelector('app-sheet.filtersheet')).not.toBeNull();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(container.querySelectorAll('.sheet__handle')).toHaveLength(1);
    expect(container.querySelector('.filtersheet__handle')).toBeNull();
  });

  it('erbt den Griff des Blatts und schließt mit einem Zug nach unten', async () => {
    const { container, fixture } = await render(FilterSheetComponent, { inputs: OPEN });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));
    const host = container.querySelector<HTMLElement>('app-sheet');
    const sheet = container.querySelector('.sheet');
    if (host === null || sheet === null) throw new Error('Blatt fehlt.');
    Object.defineProperty(host, 'clientHeight', { value: 800, configurable: true });
    Object.defineProperty(sheet, 'clientHeight', { value: 800, configurable: true });
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });

    for (const [kind, clientY] of [
      ['pointerdown', 100],
      ['pointermove', 900],
      ['pointerup', 900],
    ] as const) {
      handle.dispatchEvent(new MouseEvent(kind, { bubbles: true, clientY }));
    }

    expect(calls).toBe(1);
  });

  it('zeigt den Dialog mit Titel, Inhalt und der Haupthandlung', async () => {
    const { container } = await render(FilterSheetComponent, { inputs: OPEN });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Filter');
    expect(within(dialog).getByRole('heading', { name: 'Filter' }).closest('.sheet__head')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Show 12 species' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt Zurücksetzen weg, solange nichts gefiltert ist', async () => {
    await render(FilterSheetComponent, { inputs: OPEN });

    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
  });

  it('stellt Zurücksetzen und die Haupthandlung als Paar in den Fuß', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
    });

    const pair = container.querySelector('.footer__pair--split');
    expect(pair).not.toBeNull();
    const labels = [...(pair?.querySelectorAll('button') ?? [])].map((button) => button.textContent.trim());
    expect(labels).toEqual(['Show 12 species', 'Zurücksetzen']);
  });

  it('nimmt das X des Blatts und bringt kein eigenes mit', async () => {
    const { container, fixture } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));
    expect(container.querySelector('.filtersheet__close')).toBeNull();

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Schließen' }));

    expect(calls).toBe(1);
  });

  it('meldet Zurücksetzen und Haupthandlung je Knopf', async () => {
    const { fixture } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
    });
    const calls: string[] = [];
    fixture.componentInstance.resetClick.subscribe(() => calls.push('reset'));
    fixture.componentInstance.primaryClick.subscribe(() => calls.push('primary'));

    await userEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show 12 species' }));

    expect(calls).toEqual(['reset', 'primary']);
  });

  it('stellt in einer Gruppe den Weg zurück vor den Titel', async () => {
    const { container, fixture } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, title: 'Cap shape', back: true, resetEnabled: true },
    });
    let calls = 0;
    fixture.componentInstance.backClick.subscribe(() => (calls += 1));

    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
    expect(container.querySelector('.filtersheet__back')?.closest('.sheet__head-title')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(calls).toBe(1);
  });

  it('meldet das Schließen auf Escape', async () => {
    const { fixture } = await render(FilterSheetComponent, { inputs: OPEN });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('macht jeden Knopf zum Tippziel mit Druckzustand', async () => {
    await render(FilterSheetComponent, { inputs: { ...OPEN, resetEnabled: true } });

    for (const button of dialogButtons()) {
      expect(button).toHaveClass('tap');
      expect(button).toHaveAttribute('data-press', 'scale');
    }
  });

  it('blendet die Ränder des Inhalts aus', async () => {
    const { container } = await render(FilterSheetComponent, { inputs: OPEN });

    expect(container.querySelectorAll('.filtersheet__content.scroll')).toHaveLength(1);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
