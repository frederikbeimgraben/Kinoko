import { TestBed } from '@angular/core/testing';
import { configure } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';

// jsdom has no `matchMedia`. Without this stub, each service that asks the OS for the theme fails.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (medium: string) => ({
    matches: false,
    media: medium,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom has no rendering and no pointer.
// Without these stubs, each component that scrolls into view or catches a gesture fails.
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.scrollTo = () => undefined;
Element.prototype.scrollBy = () => undefined;

// jsdom has no layout and so no ResizeObserver.
// Without this stub, each UI that measures its own height fails.
Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe(): void {
      // Without layout, no size changes. There is nothing to report.
    }
    disconnect(): void {
      // There is nothing to release.
    }
  },
});
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;

// The tests check the German texts, so the test browser language must not select the catalog.
// Set both language sources, so that blocked storage does not change the result.
Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'de-DE' });

// jsdom does real navigation. Without stubs, the history grows across all test files.
// Then `history.back`/`go` become slow until they time out.
history.pushState = () => undefined;
history.back = () => undefined;
history.go = () => undefined;

beforeEach(() => {
  localStorage.setItem('pilzkarte.sprache', 'de');
  // This reset stops a service from keeping its state from the previous test.
  TestBed.resetTestingModule();
});

// The test files share one environment because the builder does not isolate them.
// This reset stops a mock from one file from going into the next file.
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// A role query checks the computed style of each element and its parents. In jsdom this takes
// seconds on a large page. Thus role queries also find elements hidden by CSS or aria-hidden;
// a test that checks hidden content gives `hidden: false` to the query.
configure({ defaultHidden: true });
