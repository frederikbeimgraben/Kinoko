import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ViewportService } from '../../core/layout/viewport.service';
import { SheetComponent } from './sheet.component';

/** The desktop: the shell reports the wide view. */
const WIDE = { provide: ViewportService, useValue: { wide: signal(true) } };

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
    <app-sheet label="Map" [detent]="1" [detents]="['152px', 0.4, 0.9]">
      <div head>
        <p>Header</p>
        <button type="button">Week 40</button>
      </div>
      <p>Content</p>
    </app-sheet>
  `,
})
class HeadHostComponent {}

/** The column on the desktop: the sheet in it is a modal over the full page. */
@Component({
  imports: [SheetComponent],
  template: `
    <div class="shell--column">
      <app-sheet label="Fund melden" [modal]="true"></app-sheet>
    </div>
  `,
})
class ColumnHostComponent {}

/** jsdom measures no heights, but the sheet needs them for its detents. */
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

/** Sends a drag with a time in ms for each step. The last step releases the pointer. */
function timedDrag(handle: HTMLElement, steps: readonly (readonly [number, number])[]): void {
  steps.forEach(([clientY, time], index) => {
    const kind = index === 0 ? 'pointerdown' : index === steps.length - 1 ? 'pointerup' : 'pointermove';
    const event = new MouseEvent(kind, { bubbles: true, clientY });
    Object.defineProperty(event, 'timeStamp', { value: time });
    handle.dispatchEvent(event);
  });
}

/** The host of the sheet in the test, with or without a wrapper. */
function hostOf(container: Element): HTMLElement {
  return container.querySelector<HTMLElement>('app-sheet') ?? (container as HTMLElement);
}

describe('SheetComponent', () => {
  it('renders with minimal inputs as a dialog with handle and content', async () => {
    const { container } = await render(SheetComponent, { inputs: { label: 'Porcini' } });

    expect(screen.getByRole('dialog', { name: 'Porcini' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blatt ziehen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('goes to the next detent and back to the first on a handle tap', async () => {
    const { fixture } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 2 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));

    await userEvent.click(screen.getByRole('button', { name: 'Blatt ziehen' }));

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
    screen.getByRole('button', { name: 'Blatt ziehen' }).focus();

    await userEvent.tab();

    expect(container.querySelector('[aria-modal]')).toBeNull();
  });

  it('takes the content height without detents', async () => {
    const { container } = await render(SheetComponent, { inputs: { label: 'Porcini' } });

    expect(container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('auto');
  });

  it('sets the detent with the arrow keys and stops at both ends', async () => {
    const { fixture } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 2 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    screen.getByRole('button', { name: 'Blatt ziehen' }).focus();

    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(calls).toEqual([1, 0]);
  });

  it('goes to the nearest detent on a handle drag and skips the click', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 1, detents: ['152px', 0.4, 0.9] },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 320);

    drag(handle, [500, 100, 100]);
    handle.click();

    expect(calls).toEqual([2]);
  });

  it('closes a sheet on a drag down below half of its detent', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 1, dismissible: true, detents: [0.5, 0.5, 0.5] },
    });
    let closes = 0;
    const detents: number[] = [];
    fixture.componentInstance.closed.subscribe(() => (closes += 1));
    fixture.componentInstance.detentChange.subscribe((detent) => detents.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 400);

    drag(handle, [400, 800, 800]);

    expect(closes).toBe(1);
    expect(detents).toEqual([]);
  });

  it('keeps a sheet that cannot close at its detent on a drag down', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 1, detents: [0.5, 0.5, 0.5] },
    });
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => (closes += 1));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 400);

    drag(handle, [400, 800, 800]);

    expect(closes).toBe(0);
  });

  it('leaves the detent alone on a small wobble', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 1, detents: ['152px', 0.4, 0.9] },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
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
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
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

  it('follows a fast fling up to the next detent', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 0, detents: ['152px', 0.4, 0.9] },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 152);

    timedDrag(handle, [
      [500, 0],
      [490, 10],
      [470, 20],
      [450, 30],
      [450, 40],
    ]);

    expect(calls).toEqual([1]);
  });

  it('goes to the nearest detent after a slow drag', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 0, detents: ['152px', 0.4, 0.9] },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 152);

    timedDrag(handle, [
      [500, 0],
      [490, 100],
      [470, 200],
      [450, 300],
      [450, 400],
    ]);

    expect(calls).toEqual([]);
  });

  it('closes a dismissible sheet on a fast fling down', async () => {
    const { fixture, container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', dismissible: true },
    });
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => (closes += 1));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 400);

    timedDrag(handle, [
      [400, 0],
      [420, 10],
      [450, 20],
      [480, 30],
      [480, 40],
    ]);

    expect(closes).toBe(1);
  });

  it('resists a drag above the top detent', async () => {
    const { container, fixture } = await render(SheetComponent, {
      inputs: { label: 'Porcini', detent: 2, detents: ['152px', 0.4, 0.5] },
    });
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 400);

    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 400 }));
    handle.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 300 }));
    fixture.detectChanges();

    expect(container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('430px');
  });

  it('gives the handle a ripple and no press state', async () => {
    await render(SheetComponent, { inputs: { label: 'Porcini' } });

    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });

    expect(handle).not.toHaveAttribute('data-press');
  });

  it('spans the handle across the full width so the bar sits centred', async () => {
    const { container } = await render(HostComponent);

    const handleElement = container.querySelector('.sheet__handle');
    if (!handleElement) throw new Error('The grip is missing.');
    const handle = getComputedStyle(handleElement);

    expect(handle.inlineSize).toBe('100%');
    expect(handle.justifyContent).toBe('center');
  });

  describe('on the desktop', () => {
    it('shows the head with title, note and close button', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Fund melden', title: 'Fund melden', note: '48,5203 · 9,0511' },
        providers: [WIDE],
      });

      expect(container.querySelector('.sheet--modal')).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Fund melden' })).toBeInTheDocument();
      expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();
      await noViolations(container);
    });

    it('shows only the close button in a head without a title', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      const head = container.querySelector('.sheet__head');
      expect(head).not.toBeNull();
      expect(screen.queryByRole('heading')).toBeNull();
      expect(head?.querySelector('.overlay-head__close')).toHaveAccessibleName('Schließen');
    });

    it('leaves out the head without a title and a close button', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini', closable: false },
        providers: [WIDE],
      });

      expect(container.querySelector('.sheet__head')).toBeNull();
    });

    it('leaves out the grip', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      const handle = container.querySelector('.sheet__handle');
      if (handle === null) throw new Error('The grip is missing.');

      expect(getComputedStyle(handle).display).toBe('none');
    });

    it('gives the head of the modal the padding of the kit', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini', title: 'Porcini', compact: true },
        providers: [WIDE],
      });

      const head = container.querySelector<HTMLElement>('.sheet__head');
      if (head === null) throw new Error('The head is missing.');

      expect(getComputedStyle(head).getPropertyValue('--overlay-head-pad')).toBe('12px 12px 4px 16px');
      expect(container.querySelector('.overlay-head__close')).not.toBeNull();
    });

    it('ignores the detents', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini', detent: 2, detents: [0.1, 0.5, 0.9] },
        providers: [WIDE],
      });

      expect(container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('');
    });

    it('emits closed from the button in the head', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', title: 'Porcini' },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const close = container.querySelector<HTMLElement>('.overlay-head__close');
      if (close === null) throw new Error('The close button is missing in the head.');
      await userEvent.click(close);

      expect(calls).toBe(1);
    });

    it('emits closed from the scrim', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', modal: true },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      scrim?.click();

      expect(calls).toBe(1);
    });

    it('does not close on a drag over the scrim', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', modal: true },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      if (scrim === null) throw new Error('The scrim is missing.');
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
      scrim.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 260, clientY: 180 }));
      scrim.click();

      expect(calls).toBe(0);
    });

    it('takes a press without movement on the scrim as a click', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', modal: true },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      if (scrim === null) throw new Error('The scrim is missing.');
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
      scrim.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 102, clientY: 101 }));
      scrim.click();

      expect(calls).toBe(1);
    });

    it('darkens the full page, also the column and the rail', async () => {
      const { container } = await render(ColumnHostComponent, { providers: [WIDE] });

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      if (scrim === null) throw new Error('The scrim is missing.');

      expect(getComputedStyle(scrim).position).toContain('fixed');
      expect(getComputedStyle(scrim).insetInlineStart).not.toContain('size-rail');
    });

    it('always follows the content height', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Fund melden', title: 'Fund melden' },
        providers: [WIDE],
      });

      const modal = container.querySelector<HTMLElement>('.sheet--modal');
      if (modal === null) throw new Error('The modal is missing.');

      expect(getComputedStyle(modal).blockSize).toBe('auto');
    });

    it('limits the height to the page height less 64 px', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Fund melden', title: 'Fund melden' },
        providers: [WIDE],
      });

      const modal = container.querySelector<HTMLElement>('.sheet--modal');
      if (modal === null) throw new Error('The modal is missing.');

      expect(getComputedStyle(modal).maxBlockSize).toBe('calc(100% - 64px)');
    });

    it('emits closed on Escape and stops the key', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });
      let calls = 0;
      let outside = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));
      container.addEventListener('keydown', () => (outside += 1));

      container.querySelector<HTMLElement>('.sheet')?.focus();
      await userEvent.keyboard('{Escape}');

      expect(calls).toBe(1);
      expect(outside).toBe(0);
    });

    it('shows a scrim only for a modal sheet', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      expect(container.querySelector('.sheet__scrim')).toBeNull();
    });

    it('has no scrim and no modal on the phone, but a head and a close button', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini', title: 'Porcini', modal: true },
      });

      expect(container.querySelector('.sheet__scrim')).toBeNull();
      expect(container.querySelector('.sheet--modal')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Porcini' })).toBeInTheDocument();
      expect(container.querySelector('.overlay-head__close')).not.toBeNull();
    });
  });

  it('leaves out the close button with closable=false, also with a title', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', title: 'Porcini', closable: false },
    });

    expect(container.querySelector('.overlay-head__close')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Porcini' })).toBeInTheDocument();
  });

  it('emits closed from the close button on the phone', async () => {
    const { container, fixture } = await render(SheetComponent, {
      inputs: { label: 'Porcini', title: 'Porcini' },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    const close = container.querySelector<HTMLElement>('.overlay-head__close');
    if (close === null) throw new Error('The close button is missing.');
    await userEvent.click(close);

    expect(calls).toBe(1);
  });

  it('shows the line below the head only with headDivider', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Filter', title: 'Filter', headDivider: true },
    });

    expect(container.querySelector('.sheet__head')).toHaveClass('sheet__head--divider');
  });

  it('projects an element before the title and an action into the head', async () => {
    @Component({
      imports: [SheetComponent],
      template: `
        <app-sheet label="Fund" [title]="'Fund'">
          <span titleLead>dot</span>
          <button headAction type="button">reset</button>
        </app-sheet>
      `,
    })
    class LeadHostComponent {}

    const { container } = await render(LeadHostComponent);

    const head = container.querySelector('.sheet__head');
    expect(head?.textContent).toContain('dot');
    expect(screen.getByRole('button', { name: 'reset' })).toBeInTheDocument();
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Porcini' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
