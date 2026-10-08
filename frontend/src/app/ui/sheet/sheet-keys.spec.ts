import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { ViewportService } from '../../core/layout/viewport.service';
import { SheetComponent } from './sheet.component';

const WIDE = { provide: ViewportService, useValue: { wide: signal(true) } };

@Component({
  imports: [SheetComponent],
  template: `
    <app-sheet label="Porcini" [detent]="1" [modal]="true">
      <button type="button">first</button>
      <button type="button">last</button>
    </app-sheet>
  `,
})
class ModalHostComponent {}

function press(target: HTMLElement, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function pointer(target: HTMLElement, kind: string, clientX: number, clientY: number): void {
  const event = new MouseEvent(kind, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
}

describe('SheetComponent keys and axes', () => {
  it('moves the focus from the first to the last element on Shift+Tab, and back on Tab', async () => {
    await render(ModalHostComponent);
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });
    const last = screen.getByRole('button', { name: 'last' });

    handle.focus();
    expect(press(handle, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    expect(press(last).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(handle);
  });

  it('keeps the modal trap inside the section and skips the scrim and the hidden grip', async () => {
    const { container } = await render(ModalHostComponent, { providers: [WIDE] });
    const scrim = container.querySelector<HTMLElement>('.sheet__scrim');
    const first = container.querySelector<HTMLElement>('.overlay-head__close');
    if (first === null) throw new Error('The close button is missing.');
    const last = screen.getByRole('button', { name: 'last' });

    expect(scrim?.getAttribute('tabindex')).toBe('-1');
    first.focus();
    expect(press(first, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(press(last).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('brings the focus back into the section on Shift+Tab from the section itself', async () => {
    const { container } = await render(ModalHostComponent, { providers: [WIDE] });
    const section = container.querySelector<HTMLElement>('section.sheet');
    if (section === null) throw new Error('The section is missing.');

    section.focus();

    expect(press(section, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'last' }));
  });

  it('keeps the inset of the open sheet when a closed sheet leaves the page', async () => {
    const { fixture } = await render(SheetComponent, { inputs: { label: 'Porcini' } });
    const root = document.documentElement.style;
    root.setProperty('--pilz-sheet-inset', '42px');

    (fixture.nativeElement as HTMLElement).remove();
    (fixture.componentInstance as unknown as { applyInset(): void }).applyInset();

    expect(root.getPropertyValue('--pilz-sheet-inset')).toBe('42px');
  });

  it('leaves Tab alone inside the order and other keys alone', async () => {
    await render(ModalHostComponent);
    const first = screen.getByRole('button', { name: 'first' });

    first.focus();

    expect(press(first).defaultPrevented).toBe(false);
    expect(press(first, true).defaultPrevented).toBe(false);
    const other = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    first.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  it('gives a horizontal drag to the content and keeps the detent', async () => {
    const { fixture, container } = await render(SheetComponent, { inputs: { label: 'Map', detent: 1 } });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const host = container;
    Object.defineProperty(host, 'clientHeight', { value: 800, configurable: true });
    const handle = screen.getByRole('button', { name: 'Blatt ziehen' });

    pointer(handle, 'pointerdown', 100, 500);
    pointer(handle, 'pointermove', 160, 498);
    pointer(handle, 'pointermove', 160, 100);
    pointer(handle, 'pointerup', 160, 100);

    expect(calls).toEqual([]);
    expect(container.querySelector('.sheet--dragging')).toBeNull();
  });
});
