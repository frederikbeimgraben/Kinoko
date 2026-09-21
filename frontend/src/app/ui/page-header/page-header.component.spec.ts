import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { PageHeaderComponent } from './page-header.component';

@Component({
  imports: [PageHeaderComponent],
  template: `<app-page-header><span headline>Art suchen</span></app-page-header>`,
})
class HeadlineHostComponent {}

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

    expect(screen.getByRole('button', { name: 'Zurück' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('emits backClick when the back button is pressed', async () => {
    const { fixture } = await render(PageHeaderComponent, {
      inputs: { title: 'Porcini', back: true },
    });
    let calls = 0;
    fixture.componentInstance.backClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(calls).toBe(1);
  });

  it('pulls the title in when a lead stands before it', async () => {
    const { container } = await render(PageHeaderComponent, {
      inputs: { title: 'Porcini', back: true },
    });

    expect(container.querySelector('.bar--lead')).not.toBeNull();
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

  it('shows the count next to the title', async () => {
    const { container } = await render(PageHeaderComponent, {
      inputs: { title: 'Einträge', count: '12' },
    });

    expect(container.querySelector('.bar__count')).toHaveTextContent('12');
  });

  it('leaves the count out without a value', async () => {
    const { container } = await render(PageHeaderComponent, { inputs: { title: 'Einträge' } });

    expect(container.querySelector('.bar__count')).toBeNull();
  });

  it('takes a projected headline in place of the title', async () => {
    const { container } = await render(HeadlineHostComponent);

    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('.bar')).toHaveTextContent('Art suchen');
  });

  it('holds the wide indent of a detail bar without a lead', async () => {
    const { container } = await render(PageHeaderComponent, {
      inputs: { title: 'Steinpilz', wide: true },
    });

    expect(container.querySelector('.bar--wide')).not.toBeNull();
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(PageHeaderComponent, {
      inputs: { title: 'Porcini', back: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
