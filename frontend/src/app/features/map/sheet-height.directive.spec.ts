import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SheetHeightDirective } from './sheet-height.directive';
import { MapState } from './map.state';

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

/** Der Beobachter des Tests: er meldet erst, wenn der Test es sagt. */
function observer(): { report: () => void } {
  const handle = { report: (): void => undefined };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        handle.report = callback;
      }
      observe(): void {
        // Ohne Layout ändert sich keine Größe von selbst.
      }
      disconnect(): void {
        // Es gibt nichts zu lösen.
      }
    },
  );
  return handle;
}

/** jsdom rechnet kein Layout; jedes Element beginnt dort, wo der Test es sagt. */
function stubTop(sheetTop: number, hostTop: number): void {
  const real = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      return { top: this.classList.contains('sheet') ? sheetTop : hostTop } as DOMRect;
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

    expect(TestBed.inject(MapState).overlayHeight()).toBe(240);
  });

  it('misst die Leiste selbst, solange im Wirt kein Blatt steht', async () => {
    const handle = observer();
    stubTop(0, window.innerHeight - 144);
    const { fixture, detectChanges } = await render(HostComponent);
    fixture.componentInstance.withSheet.set(false);
    detectChanges();

    handle.report();

    expect(TestBed.inject(MapState).overlayHeight()).toBe(144);
  });

  it('stellt die Überlagerung zurück, sobald das Blatt geht', async () => {
    const { fixture, detectChanges } = await render(HostComponent);
    const state = TestBed.inject(MapState);
    state.overlayHeight.set(240);

    fixture.componentInstance.open.set(false);
    detectChanges();

    expect(state.overlayHeight()).toBe(0);
  });
});
