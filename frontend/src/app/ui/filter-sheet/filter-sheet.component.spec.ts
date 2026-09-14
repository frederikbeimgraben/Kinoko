import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FilterSheetComponent } from './filter-sheet.component';

/** Die Knöpfe des Blatts, ohne den Scrim des Overlay-Wirts. */
function dialogButtons(): HTMLElement[] {
  return within(screen.getByRole('dialog')).getAllByRole('button');
}

describe('FilterSheetComponent', () => {
  it('renders nothing while closed', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { open: false, primaryLabel: 'Show 12 species' },
    });

    expect(container.querySelector('.filtersheet')).toBeNull();
  });

  it('renders the dialog with the content slot and the primary action', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { open: true, primaryLabel: 'Show 12 species' },
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show 12 species' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('leaves out the reset button while nothing is filtered', async () => {
    await render(FilterSheetComponent, { inputs: { open: true, primaryLabel: 'Show 12 species' } });

    expect(dialogButtons()).toHaveLength(2);
  });

  it('shows the reset button once a filter is active', async () => {
    await render(FilterSheetComponent, {
      inputs: { open: true, primaryLabel: 'Show 12 species', resetEnabled: true },
    });

    expect(dialogButtons()).toHaveLength(3);
  });

  it('emits resetClick, primaryClick and closed for their buttons', async () => {
    const { fixture } = await render(FilterSheetComponent, {
      inputs: { open: true, primaryLabel: 'Show 12 species', resetEnabled: true },
    });
    const calls: string[] = [];
    fixture.componentInstance.resetClick.subscribe(() => calls.push('reset'));
    fixture.componentInstance.primaryClick.subscribe(() => calls.push('primary'));
    fixture.componentInstance.closed.subscribe(() => calls.push('closed'));
    const buttons = dialogButtons();

    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);
    await userEvent.click(buttons[2]);

    expect(calls).toEqual(['reset', 'closed', 'primary']);
  });

  it('emits closed on Escape', async () => {
    const { fixture } = await render(FilterSheetComponent, {
      inputs: { open: true, primaryLabel: 'Show 12 species' },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('marks every button as a tap target with a press state', async () => {
    await render(FilterSheetComponent, {
      inputs: { open: true, primaryLabel: 'Show 12 species', resetEnabled: true },
    });

    for (const button of dialogButtons()) {
      expect(button).toHaveClass('tap');
      expect(button).toHaveAttribute('data-press', 'scale');
    }
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(FilterSheetComponent, {
      inputs: { open: true, primaryLabel: 'Show 12 species', resetEnabled: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
