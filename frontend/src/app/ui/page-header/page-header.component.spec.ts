import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { PageHeaderComponent } from './page-header.component';

@Component({
  imports: [PageHeaderComponent],
  template: `<app-page-header title="Einträge"><span marks>Offline</span></app-page-header>`,
})
class MarkedHostComponent {}

describe('PageHeaderComponent', () => {
  it('renders with minimal inputs', async () => {
    const { container } = await render(PageHeaderComponent, { inputs: { title: 'Species' } });

    expect(screen.getByRole('heading', { name: 'Species' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('shows the back button when the page has one', async () => {
    const { container } = await render(PageHeaderComponent, {
      inputs: { title: 'Porcini', back: true },
    });

    expect(screen.getByRole('button')).toBeInTheDocument();
    await noViolations(container);
  });

  it('emits backClick when the back button is pressed', async () => {
    const { fixture } = await render(PageHeaderComponent, {
      inputs: { title: 'Porcini', back: true },
    });
    let calls = 0;
    fixture.componentInstance.backClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button'));

    expect(calls).toBe(1);
  });

  it('marks the back button as a tap target with a press state', async () => {
    await render(PageHeaderComponent, { inputs: { title: 'Porcini', back: true } });

    const back = screen.getByRole('button');

    expect(back).toHaveClass('tap');
    expect(back).toHaveAttribute('data-press', 'scale');
  });

  it('shows the close button when the page has one', async () => {
    const { container } = await render(PageHeaderComponent, {
      inputs: { title: 'Settings', close: true },
    });

    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('emits closeClick when the close button is pressed', async () => {
    const { fixture } = await render(PageHeaderComponent, {
      inputs: { title: 'Settings', close: true },
    });
    let calls = 0;
    fixture.componentInstance.closeClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(calls).toBe(1);
  });

  it('projects a mark next to the title', async () => {
    const { container } = await render(MarkedHostComponent);

    expect(container.querySelector('.pageheader__marks')).toContainHTML('Offline');
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(PageHeaderComponent, {
      inputs: { title: 'Porcini', back: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
