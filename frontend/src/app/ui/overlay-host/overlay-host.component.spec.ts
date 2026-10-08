import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ViewportService } from '../../core/layout/viewport.service';
import { OverlayHostComponent } from './overlay-host.component';

/** The desktop: the shell reports the wide view. */
const WIDE = { provide: ViewportService, useValue: { wide: signal(true) } };

@Component({
  imports: [OverlayHostComponent],
  template: `<app-overlay-host [open]="true"><p>Layers</p></app-overlay-host>`,
})
class HostComponent {}

describe('OverlayHostComponent', () => {
  it('renders nothing while closed', async () => {
    const { container } = await render(OverlayHostComponent, { inputs: { open: false } });

    expect(container.querySelector('.overlay__scrim')).toBeNull();
    expect(container.querySelector('.overlay__panel')).toBeNull();
  });

  it('renders the scrim and the projected content while open', async () => {
    const { container } = await render(HostComponent);

    expect(container.querySelector('.overlay__scrim')).not.toBeNull();
    expect(screen.getByText('Layers')).toBeInTheDocument();
    await noViolations(container);
  });

  it('emits closed when the scrim is pressed', async () => {
    const { fixture } = await render(OverlayHostComponent, { inputs: { open: true } });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button'));

    expect(calls).toBe(1);
  });

  it('emits closed on Escape inside the panel', async () => {
    const { container, fixture } = await render(OverlayHostComponent, { inputs: { open: true } });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));
    const panel = container.querySelector<HTMLElement>('.overlay__panel');

    panel?.focus();
    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('focuses the panel once it opens', async () => {
    const { container, fixture } = await render(OverlayHostComponent, { inputs: { open: false } });

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(document.activeElement).toBe(container.querySelector('.overlay__panel'));
  });

  it('leaves the head and the modal to the sheet', async () => {
    const { container } = await render(HostComponent, { providers: [WIDE] });

    expect(container.querySelector('.overlay__head')).toBeNull();
    expect(container.querySelector('.overlay__close')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('drops the rise on the desktop, wherever the host is in the tree', async () => {
    const { container } = await render(HostComponent, { providers: [WIDE] });

    const panel = container.querySelector('.overlay__panel');
    expect(panel).toHaveClass('overlay__panel--wide');
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(OverlayHostComponent, {
      inputs: { open: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
