import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SheetComponent } from './sheet.component';

@Component({
  imports: [SheetComponent],
  template: `
    <app-sheet label="Porcini" [detent]="1" [modal]="true">
      <button type="button">first</button>
      <button type="button">second</button>
    </app-sheet>
  `,
})
class HostComponent {}

@Component({
  imports: [SheetComponent],
  template: `
    <app-sheet label="Map" [detent]="1">
      <div head>
        <p>Header</p>
        <button type="button">Week 40</button>
      </div>
      <p>Content</p>
    </app-sheet>
  `,
})
class HeadHostComponent {}

/** jsdom misst keine Höhen, das Blatt braucht sie aber, um zu rasten. */
function fakeSize(host: HTMLElement, hostHeight: number, sheetHeight: number): void {
  Object.defineProperty(host, 'clientHeight', { value: hostHeight, configurable: true });
  const sheet = host.querySelector('.sheet');
  if (sheet) Object.defineProperty(sheet, 'clientHeight', { value: sheetHeight, configurable: true });
}

function drag(handle: HTMLElement, sizes: readonly number[]): void {
  const kinds = ['pointerdown', 'pointermove', 'pointerup'];
  sizes.forEach((clientY, index) => {
    handle.dispatchEvent(new MouseEvent(kinds[Math.min(index, 2)], { bubbles: true, clientY }));
  });
}

/** Der Wirt des Blatts im Testaufbau. */
function hostOf(container: Element): HTMLElement {
  const host = container.querySelector<HTMLElement>('app-sheet');
  if (!host) throw new Error('Kein Blatt im Baum.');
  return host;
}

describe('SheetComponent', () => {
  it('renders with minimal inputs as a dialog with handle and content', async () => {
    const { container } = await render(SheetComponent, { inputs: { label: 'Porcini' } });

    expect(screen.getByRole('dialog', { name: 'Porcini' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blatt greifen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('goes to the next detent and back to the first on a handle tap', async () => {
    const { fixture } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 2 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));

    await userEvent.click(screen.getByRole('button', { name: 'Blatt greifen' }));

    expect(calls).toEqual([0]);
  });

  it('sets the block size of the chosen detent', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 2, detents: [0.1, 0.5, 0.9] },
    });

    expect(container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('90%');
  });

  it('lets the content detent size itself', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Find location', detents: ['content', 'content', 'content'] as const },
    });

    expect(container.querySelector('.sheet')).toHaveStyle({ 'block-size': 'auto' });
  });

  it('traps the tab order inside a modal sheet', async () => {
    await render(HostComponent);
    const first = screen.getByRole('button', { name: 'first' });
    const second = screen.getByRole('button', { name: 'second' });

    second.focus();
    await userEvent.tab();

    expect(document.activeElement).not.toBe(second);
    first.focus();
    await userEvent.tab({ shift: true });

    expect(document.activeElement).not.toBe(first);
  });

  it('lets the tab order run free in a non-modal sheet', async () => {
    const { container } = await render(SheetComponent, { inputs: { label: 'Porcini' } });
    screen.getByRole('button', { name: 'Blatt greifen' }).focus();

    await userEvent.tab();

    expect(container.querySelector('[aria-modal]')).toBeNull();
  });

  it('sets the detent with the arrow keys and stops at both ends', async () => {
    const { fixture } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 2 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    screen.getByRole('button', { name: 'Blatt greifen' }).focus();

    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(calls).toEqual([1, 0]);
  });

  it('goes to the nearest detent on a handle drag and skips the click', async () => {
    const { fixture, container } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 1 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt greifen' });
    fakeSize(hostOf(container), 800, 320);

    drag(handle, [500, 100, 100]);
    handle.click();

    expect(calls).toEqual([2]);
  });

  it('leaves the detent alone on a small wobble', async () => {
    const { fixture, container } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 1 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt greifen' });
    fakeSize(hostOf(container), 800, 320);

    drag(handle, [500, 495, 494]);

    expect(calls).toEqual([]);
  });

  it('measures a content detent when a drag lands near it', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 1, detents: ['content', 0.4, 0.9] },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt greifen' });
    fakeSize(hostOf(container), 800, 120);

    drag(handle, [500, 700, 700]);

    expect(calls).toEqual([0]);
  });

  it('drags from the projected head, not only from the handle', async () => {
    const { fixture, container } = await render(HeadHostComponent);
    const sheet = fixture.debugElement.children[0].componentInstance as SheetComponent;
    const calls: number[] = [];
    sheet.detentChange.subscribe((detent) => calls.push(detent));
    fakeSize(hostOf(container), 800, 320);
    const week = screen.getByText('Header');

    drag(week, [500, 100, 100]);

    expect(calls).toEqual([2]);
  });

  it('leaves a tap in the head a tap', async () => {
    const { fixture, container } = await render(HeadHostComponent);
    const sheet = fixture.debugElement.children[0].componentInstance as SheetComponent;
    const calls: number[] = [];
    sheet.detentChange.subscribe((detent) => calls.push(detent));
    fakeSize(hostOf(container), 800, 320);
    const week = screen.getByRole('button', { name: 'Week 40' });
    let tapped = 0;
    week.addEventListener('click', () => (tapped += 1));

    drag(week, [500, 497, 497]);
    week.click();

    expect(calls).toEqual([]);
    expect(tapped).toBe(1);
  });

  it('marks the handle as a tap target with a press state', async () => {
    await render(SheetComponent, { inputs: { label: 'Porcini' } });

    const handle = screen.getByRole('button', { name: 'Blatt greifen' });

    expect(handle).toHaveClass('tap');
    expect(handle).toHaveAttribute('data-press', 'scale');
  });

  it('spans the handle across the full width so the bar sits centred', async () => {
    const { container } = await render(HostComponent);

    const handleElement = container.querySelector('.sheet__handle');
    if (!handleElement) throw new Error('Griff fehlt im Baum.');
    const handle = getComputedStyle(handleElement);

    expect(handle.inlineSize).toBe('100%');
    expect(handle.justifyContent).toBe('center');
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Porcini' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
