import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { SheetComponent } from './sheet.component';

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
  target.dispatchEvent(new MouseEvent(kind, { bubbles: true, clientX, clientY }));
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
    const host = container as HTMLElement;
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
