import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FilterChipComponent } from '../filter-chip/filter-chip.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { PageHeaderComponent } from './page-header.component';

@Component({
  imports: [PageHeaderComponent],
  template: `<app-page-header><span headline>Art suchen</span></app-page-header>`,
})
class HeadlineHostComponent {}

@Component({
  imports: [PageHeaderComponent, FilterChipComponent, IconButtonComponent],
  template: `<app-page-header title="Steinpilz" [back]="true">
    <app-icon-button icon="more" kind="plain" label="Mehr" />
    <app-filter-chip label="Vergleichen" icon="compare" />
  </app-page-header>`,
})
class DetailHostComponent {}

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

  it('keeps the space of an empty title and shows no empty heading', async () => {
    const { container } = await render(PageHeaderComponent, { inputs: { title: '', back: true } });

    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('.bar__title')).toBeInTheDocument();
    await noViolations(container);
  });

  it('puts a projected chip before the buttons, in its own slot', async () => {
    const { container } = await render(DetailHostComponent);

    const chips = container.querySelector('.bar__chips');
    expect(chips?.querySelector('app-filter-chip')).not.toBeNull();
    expect(chips?.nextElementSibling?.tagName).toBe('APP-ICON-BUTTON');
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
