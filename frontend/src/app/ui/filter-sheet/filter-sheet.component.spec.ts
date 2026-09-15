import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FilterSheetComponent } from './filter-sheet.component';

const OPEN = { open: true, title: 'Filter', primaryLabel: 'Show 12 species' };

/** Die Knöpfe des Blatts, ohne den Scrim des Overlay-Wirts. */
function dialogButtons(): HTMLElement[] {
  return within(screen.getByRole('dialog')).getAllByRole('button');
}

describe('FilterSheetComponent', () => {
  it('zeigt nichts, solange das Blatt zu ist', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, open: false },
    });

    expect(container.querySelector('.filtersheet')).toBeNull();
  });

  it('zeigt den Dialog mit Titel, Inhalt und der Haupthandlung', async () => {
    const { container } = await render(FilterSheetComponent, { inputs: OPEN });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Filter');
    expect(within(dialog).getByRole('heading', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show 12 species' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt Zurücksetzen weg, solange nichts gefiltert ist', async () => {
    await render(FilterSheetComponent, { inputs: OPEN });

    expect(dialogButtons()).toHaveLength(1);
  });

  it('zeigt Zurücksetzen, sobald ein Filter steht', async () => {
    await render(FilterSheetComponent, { inputs: { ...OPEN, resetEnabled: true } });

    expect(dialogButtons()).toHaveLength(2);
  });

  it('lässt der Übersicht kein X im Kopf', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
    });

    expect(container.querySelector('.filtersheet__close')).toBeNull();
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Schließen' })).toBeNull();
  });

  it('meldet Zurücksetzen und Haupthandlung je Knopf', async () => {
    const { fixture } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
    });
    const calls: string[] = [];
    fixture.componentInstance.resetClick.subscribe(() => calls.push('reset'));
    fixture.componentInstance.primaryClick.subscribe(() => calls.push('primary'));
    const buttons = dialogButtons();

    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);

    expect(calls).toEqual(['reset', 'primary']);
  });

  it('stellt in einer Gruppe den Weg zurück statt Zurücksetzen', async () => {
    const { container, fixture } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, title: 'Cap shape', back: true, resetEnabled: true },
    });
    let calls = 0;
    fixture.componentInstance.backClick.subscribe(() => (calls += 1));

    expect(container.querySelector('.filtersheet__reset')).toBeNull();
    expect(container.querySelector('.filtersheet__close')).toBeNull();
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

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
