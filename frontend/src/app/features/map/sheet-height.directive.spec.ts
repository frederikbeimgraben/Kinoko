import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SheetHeightDirective } from './sheet-height.directive';
import { MapStore } from './map.store';

@Component({
  imports: [SheetHeightDirective],
  template: `
    @if (open()) {
      <div appSheetHeight>
        @if (withSheet()) {
          <div class="sheet"></div>
        }
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(true);
  readonly withSheet = signal(true);
}

/** The observer of the test: it reports only when the test tells it to. */
function observer(): { report: () => void } {
  const handle = { report: (): void => undefined };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        handle.report = callback;
      }
      observe(): void {
        // Without a layout, no size changes by itself.
      }
      disconnect(): void {
        // There is nothing to disconnect.
      }
    },
  );
  return handle;
}

/** jsdom has no layout. Each element starts where the test tells. */
function stubTop(sheetTop: number, hostTop: number, size = 100): void {
  const real = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      return {
        top: this.classList.contains('sheet') ? sheetTop : hostTop,
        width: size,
        height: size,
      } as DOMRect;
    },
  });
  if (real) afterEach(() => Object.defineProperty(Element.prototype, 'getBoundingClientRect', real));
}

describe('SheetHeightDirective', () => {
  it('meldet den Streifen unter dem Blatt an den Kartenzustand', async () => {
    const handle = observer();
    stubTop(window.innerHeight - 240, 0);
    await render(HostComponent);

    handle.report();

    expect(TestBed.inject(MapStore).overlayHeight()).toBe(240);
  });

  it('misst die Leiste selbst, solange im Wirt kein Blatt steht', async () => {
    const handle = observer();
    stubTop(0, window.innerHeight - 144);
    const { fixture, detectChanges } = await render(HostComponent);
    fixture.componentInstance.withSheet.set(false);
    detectChanges();

    handle.report();

    expect(TestBed.inject(MapStore).overlayHeight()).toBe(144);
  });

  it('meldet nichts, solange das Blatt keine Fläche hat', async () => {
    const handle = observer();
    stubTop(0, 0, 0);
    await render(HostComponent);

    handle.report();

    expect(TestBed.inject(MapStore).overlayHeight()).toBe(0);
  });

  it('stellt die Überlagerung zurück, sobald das Blatt geht', async () => {
    const { fixture, detectChanges } = await render(HostComponent);
    const state = TestBed.inject(MapStore);
    state.setOverlayHeight(240);

    fixture.componentInstance.open.set(false);
    detectChanges();

    expect(state.overlayHeight()).toBe(0);
  });
});
