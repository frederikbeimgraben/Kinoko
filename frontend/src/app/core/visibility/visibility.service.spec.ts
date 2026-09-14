import { TestBed } from '@angular/core/testing';
import { VisibilityService } from './visibility.service';

function setState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('VisibilityService', () => {
  afterEach(() => {
    setState('visible');
  });

  it('meldet den Wechsel in den Hintergrund und zurück', () => {
    TestBed.configureTestingModule({});
    const visibility = TestBed.inject(VisibilityService);
    expect(visibility.visible()).toBe(true);

    setState('hidden');
    expect(visibility.visible()).toBe(false);

    setState('visible');
    expect(visibility.visible()).toBe(true);
  });
});
