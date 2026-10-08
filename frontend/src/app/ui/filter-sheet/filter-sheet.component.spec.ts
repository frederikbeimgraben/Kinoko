import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FilterSheetComponent } from './filter-sheet.component';

const OPEN = { open: true, title: 'Filter', primaryLabel: 'Show 12 species' };

describe('FilterSheetComponent', () => {
  it('shows nothing while the sheet is closed', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, open: false },
    });

    expect(container.querySelector('.filtersheet')).toBeNull();
  });

  it('builds on the sheet and has no frame of its own', async () => {
    const { container } = await render(FilterSheetComponent, { inputs: OPEN });

    expect(container.querySelector('app-sheet.filtersheet')).not.toBeNull();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(container.querySelectorAll('.sheet__handle')).toHaveLength(1);
    expect(container.querySelector('.filtersheet__handle')).toBeNull();
  });

  it('uses the grip of the sheet and closes on a drag down', async () => {
    const { container, fixture } = await render(FilterSheetComponent, { inputs: OPEN });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));
    const host = container.querySelector<HTMLElement>('app-sheet');
    const sheet = container.querySelector('.sheet');
    if (host === null || sheet === null) throw new Error('The sheet is missing.');
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

  it('shows the dialog with title, content and the main action', async () => {
    const { container } = await render(FilterSheetComponent, { inputs: OPEN });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Filter');
    expect(within(dialog).getByRole('heading', { name: 'Filter' }).closest('.sheet__head')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Show 12 species' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('leaves out reset while nothing is filtered', async () => {
    await render(FilterSheetComponent, { inputs: OPEN });

    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
  });

  it('puts reset and the main action side by side into the foot', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
    });

    const acts = container.querySelector('app-action-bar[foot] .acts');
    expect(acts).not.toBeNull();
    const labels = [...(acts?.querySelectorAll('button') ?? [])].map((button) => button.textContent.trim());
    expect(labels).toEqual(['Show 12 species', 'Zurücksetzen']);
  });

  it('uses the close button of the sheet', async () => {
    const { container, fixture } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));
    expect(container.querySelector('.filtersheet__close')).toBeNull();

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Schließen' }));

    expect(calls).toBe(1);
  });

  it('emits reset and the main action for each button', async () => {
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

  it('shows the back button instead of the close button in a group', async () => {
    const { container, fixture } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, title: 'Cap shape', back: true, resetEnabled: true },
    });
    let calls = 0;
    fixture.componentInstance.backClick.subscribe(() => (calls += 1));

    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
    expect(container.querySelector('.sheet__head .overlay-head__back')).not.toBeNull();
    expect(container.querySelector('.overlay-head__close')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(calls).toBe(1);
  });

  it('emits closed on Escape', async () => {
    const { fixture } = await render(FilterSheetComponent, { inputs: OPEN });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('fades the edges of the content', async () => {
    const { container } = await render(FilterSheetComponent, { inputs: OPEN });

    expect(container.querySelectorAll('.filtersheet__content.scroll')).toHaveLength(1);
  });

  it('shows no German word against an empty catalogue', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { ...OPEN, resetEnabled: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
