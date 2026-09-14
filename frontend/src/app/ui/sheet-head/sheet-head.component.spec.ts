import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SheetHeadComponent } from './sheet-head.component';

describe('SheetHeadComponent', () => {
  it('renders with minimal inputs', async () => {
    const { container } = await render(SheetHeadComponent, { inputs: { title: 'Porcini' } });

    expect(screen.getByText('Porcini')).toBeInTheDocument();
    await noViolations(container);
  });

  it('shows the title as a link, the week and the hint', async () => {
    const { container } = await render(SheetHeadComponent, {
      inputs: { title: 'Porcini', week: 'Week 40 · 2025', hint: '· Forecast', titleLink: true },
    });

    expect(screen.getByRole('button', { name: 'Porcini' })).toBeInTheDocument();
    expect(screen.getByText('Week 40 · 2025')).toBeInTheDocument();
    expect(screen.getByText('· Forecast')).toBeInTheDocument();
    await noViolations(container);
  });

  it('emits titleClick when the title link is pressed', async () => {
    const { fixture } = await render(SheetHeadComponent, {
      inputs: { title: 'Porcini', titleLink: true },
    });
    let calls = 0;
    fixture.componentInstance.titleClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Porcini' }));

    expect(calls).toBe(1);
  });

  it('emits back, playback and forward for the three arrows', async () => {
    const { fixture } = await render(SheetHeadComponent, { inputs: { title: 'Porcini' } });
    const calls: string[] = [];
    fixture.componentInstance.back.subscribe(() => calls.push('back'));
    fixture.componentInstance.playback.subscribe(() => calls.push('playback'));
    fixture.componentInstance.forward.subscribe(() => calls.push('forward'));
    const buttons = screen.getAllByRole('button');

    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);
    await userEvent.click(buttons[2]);

    expect(calls).toEqual(['back', 'playback', 'forward']);
  });

  it('shows the pause icon and a pressed state while playing', async () => {
    const { fixture } = await render(SheetHeadComponent, { inputs: { title: 'Porcini', playing: false } });
    const buttons = screen.getAllByRole('button');

    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');

    fixture.componentRef.setInput('playing', true);
    fixture.detectChanges();

    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves out the title link and the arrows when the head has none', async () => {
    await render(SheetHeadComponent, { inputs: { title: 'Combination', arrows: false } });

    expect(screen.getByText('Combination')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('marks every arrow as a tap target with a press state', async () => {
    await render(SheetHeadComponent, { inputs: { title: 'Porcini' } });

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('tap');
      expect(button).toHaveAttribute('data-press', 'scale');
    }
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(SheetHeadComponent, {
      inputs: { title: 'Porcini', week: 'Week 40', titleLink: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
