import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ViewportService } from '../../core/layout/viewport.service';
import { SheetComponent } from './sheet.component';

/** Der Rechner: die Hülle meldet die breite Ansicht. */
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

/** Die Spalte am Rechner: das Blatt sitzt darin als Modal über der ganzen Seite. */
@Component({
  imports: [SheetComponent],
  template: `
    <div class="shell--column">
      <app-sheet label="Fund melden" [modal]="true"></app-sheet>
    </div>
  `,
})
class ColumnHostComponent {}

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

/** Der Wirt des Blatts im Testaufbau, mit oder ohne umgebende Hülle. */
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
    const { fixture, container } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 1 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    fakeSize(hostOf(container), 800, 320);

    drag(handle, [500, 100, 100]);
    handle.click();

    expect(calls).toEqual([2]);
  });

  it('schließt ein Blatt mit Zug nach unten unter die halbe Raste', async () => {
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

  it('lässt ein Blatt ohne Schließen am Zug nach unten rasten', async () => {
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
    const { fixture, container } = await render(SheetComponent, { inputs: { label: 'Porcini', detent: 1 } });
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

  it('marks the handle as a tap target with a press state', async () => {
    await render(SheetComponent, { inputs: { label: 'Porcini' } });

    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });

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

  describe('am Rechner', () => {
    it('trägt den Kopf mit Titel, Zusatz und Schließen', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Fund melden', title: 'Fund melden', note: '48,5203 · 9,0511' },
        providers: [WIDE],
      });

      expect(container.querySelector('.sheet--modal')).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Fund melden' })).toBeInTheDocument();
      expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();
      await noViolations(container);
    });

    it('lässt den Kopf ohne Titel weg', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      expect(container.querySelector('.sheet__head')).toBeNull();
    });

    it('trägt das X auch über einem Inhalt mit eigenem Titel', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      const close = container.querySelector<HTMLElement>('.sheet__close');
      if (close === null) throw new Error('Schließen fehlt.');

      expect(close).toHaveAccessibleName('Schließen');
      expect(getComputedStyle(close).position).toBe('absolute');
      expect(getComputedStyle(close).insetBlockStart).toBe('var(--size-modal-close-inset)');
      expect(getComputedStyle(close).insetInlineEnd).toBe('var(--size-modal-close-inset)');
      expect(getComputedStyle(close).inlineSize).toBe('var(--size-modal-close)');
      expect(getComputedStyle(close).blockSize).toBe('var(--size-modal-close)');
    });

    it('lässt den Griff weg', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      const handle = container.querySelector('.sheet__handle');
      if (handle === null) throw new Error('Griff fehlt im Baum.');

      expect(getComputedStyle(handle).display).toBe('none');
    });

    it('setzt über einem eigenen Titel denselben Abstand wie über dem Kopf', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      const content = container.querySelector('.sheet__content');
      if (content === null) throw new Error('Inhalt fehlt.');

      expect(getComputedStyle(content).paddingBlockStart).toBe('var(--space-modal-head)');
    });

    it('trägt im schmalen Modal denselben Kopf und dasselbe X', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini', title: 'Porcini', compact: true },
        providers: [WIDE],
      });

      const head = container.querySelector<HTMLElement>('.sheet__head');
      if (head === null) throw new Error('Kopf fehlt.');
      const style = getComputedStyle(head);

      expect(style.padding).toBe('4px var(--space-modal-head-end) 14px var(--space-modal-head)');
      expect(container.querySelector('.sheet__close')).not.toBeNull();
    });

    it('lässt die Rasten weg', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini', detent: 2, detents: [0.1, 0.5, 0.9] },
        providers: [WIDE],
      });

      expect(container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('');
    });

    it('meldet das Schließen über den Knopf im Kopf', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', title: 'Porcini' },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const close = container.querySelector<HTMLElement>('.sheet__close');
      if (close === null) throw new Error('Schließen fehlt im Kopf.');
      await userEvent.click(close);

      expect(calls).toBe(1);
    });

    it('meldet das Schließen über den Scrim', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', modal: true },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      scrim?.click();

      expect(calls).toBe(1);
      expect(scrim).toHaveClass('tap');
    });

    it('lässt einen Zug über die Abdunkelung das Blatt nicht schließen', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', modal: true },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      if (scrim === null) throw new Error('Scrim fehlt.');
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
      scrim.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 260, clientY: 180 }));
      scrim.click();

      expect(calls).toBe(0);
    });

    it('nimmt einen Druck ohne Bewegung auf der Abdunkelung als Klick', async () => {
      const { container, fixture } = await render(SheetComponent, {
        inputs: { label: 'Porcini', modal: true },
        providers: [WIDE],
      });
      let calls = 0;
      fixture.componentInstance.closed.subscribe(() => (calls += 1));

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      if (scrim === null) throw new Error('Scrim fehlt.');
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
      scrim.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 102, clientY: 101 }));
      scrim.click();

      expect(calls).toBe(1);
    });

    it('dunkelt die ganze Seite ab, auch die Spalte und die Leiste', async () => {
      const { container } = await render(ColumnHostComponent, { providers: [WIDE] });

      const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
      if (scrim === null) throw new Error('Scrim fehlt.');

      expect(getComputedStyle(scrim).position).toBe('fixed');
      expect(getComputedStyle(scrim).insetInlineStart).not.toContain('size-rail');
    });

    it('folgt mit der Höhe immer dem Inhalt', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Fund melden', title: 'Fund melden' },
        providers: [WIDE],
      });

      const modal = container.querySelector<HTMLElement>('.sheet--modal');
      if (modal === null) throw new Error('Modal fehlt.');

      expect(getComputedStyle(modal).blockSize).toBe('auto');
    });

    it('deckelt die Höhe bei 80 % der Seitenhöhe', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Fund melden', title: 'Fund melden' },
        providers: [WIDE],
      });

      const modal = container.querySelector<HTMLElement>('.sheet--modal');
      if (modal === null) throw new Error('Modal fehlt.');

      expect(getComputedStyle(modal).maxBlockSize).toBe('80%');
    });

    it('meldet das Schließen auf Escape und lässt die Taste nicht weiter', async () => {
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

    it('dunkelt nur ab, was das Blatt sperrt', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini' },
        providers: [WIDE],
      });

      expect(container.querySelector('.sheet__scrim')).toBeNull();
    });

    it('lässt am Telefon Scrim und Modal weg, trägt aber Kopf und X', async () => {
      const { container } = await render(SheetComponent, {
        inputs: { label: 'Porcini', title: 'Porcini', modal: true },
      });

      expect(container.querySelector('.sheet__scrim')).toBeNull();
      expect(container.querySelector('.sheet--modal')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Porcini' })).toBeInTheDocument();
      expect(container.querySelector('.sheet__close')).not.toBeNull();
    });
  });

  it('lässt das X mit closable=false weg, auch mit Titel', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Porcini', title: 'Porcini', closable: false },
    });

    expect(container.querySelector('.sheet__close')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Porcini' })).toBeInTheDocument();
  });

  it('meldet das Schließen über das X am Telefon', async () => {
    const { container, fixture } = await render(SheetComponent, {
      inputs: { label: 'Porcini', title: 'Porcini' },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    const close = container.querySelector<HTMLElement>('.sheet__close');
    if (close === null) throw new Error('X fehlt.');
    await userEvent.click(close);

    expect(calls).toBe(1);
  });

  it('zieht die Linie unter dem Kopf nur mit headDivider', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Filter', title: 'Filter', headDivider: true },
    });

    expect(container.querySelector('.sheet__head')).toHaveClass('sheet__head--divider');
  });

  it('projiziert ein Element vor den Titel und eine Aktion in die Unterzeile', async () => {
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
