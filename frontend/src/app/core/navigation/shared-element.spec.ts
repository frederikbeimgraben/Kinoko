import { Component, signal } from '@angular/core';
import { render } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import {
  SharedElementDirective,
  attachSharedElement,
  shareOnNextRoute,
  sharedElementName,
} from './shared-element';

@Component({
  imports: [SharedElementDirective],
  template: `<div class="hero" [appSharedElement]="key()"></div>`,
})
class HeroHostComponent {
  readonly key = signal('boletus-edulis');
}

/** A transition double whose promises the test resolves. */
function transitionDouble(): {
  transition: ViewTransition;
  update: () => void;
  finish: () => void;
} {
  let update = (): void => undefined;
  let finish = (): void => undefined;
  const updateCallbackDone = new Promise<undefined>((resolve) => {
    update = () => {
      resolve(undefined);
    };
  });
  const finished = new Promise<undefined>((resolve) => {
    finish = () => {
      resolve(undefined);
    };
  });
  const transition = {
    updateCallbackDone,
    finished,
    ready: Promise.resolve(undefined),
    skipTransition: () => undefined,
  } as unknown as ViewTransition;
  return { transition, update, finish };
}

describe('sharedElementName', () => {
  it('makes a valid CSS name from any key', () => {
    expect(sharedElementName('boletus edulis/1')).toBe('shared-boletus_edulis_1');
  });
});

describe('shared elements', () => {
  it('names the source and the target for one route change', async () => {
    const { container, detectChanges } = await render(HeroHostComponent);
    const hero = container.querySelector<HTMLElement>('.hero');
    const thumb = document.createElement('img');
    const { transition, update, finish } = transitionDouble();

    shareOnNextRoute(thumb, 'boletus-edulis');
    expect(thumb.style.getPropertyValue('view-transition-name')).toBe('shared-boletus-edulis');
    attachSharedElement(transition, false);
    detectChanges();

    // The new page has the name one time only, also when the list stays on the page.
    expect(hero?.style.getPropertyValue('view-transition-name')).toBe('shared-boletus-edulis');
    expect(thumb.style.getPropertyValue('view-transition-name')).toBe('');

    update();
    await transition.updateCallbackDone;
    expect(thumb.style.getPropertyValue('view-transition-name')).toBe('');

    finish();
    await transition.finished;
    detectChanges();
    expect(hero?.style.getPropertyValue('view-transition-name')).toBe('');
  });

  it('removes the names at once when the transition is skipped', async () => {
    const { container, detectChanges } = await render(HeroHostComponent);
    const hero = container.querySelector<HTMLElement>('.hero');
    const thumb = document.createElement('img');

    shareOnNextRoute(thumb, 'boletus-edulis');
    attachSharedElement(transitionDouble().transition, true);
    detectChanges();

    expect(thumb.style.getPropertyValue('view-transition-name')).toBe('');
    expect(hero?.style.getPropertyValue('view-transition-name')).toBe('');
  });

  it('does not name a target with another key', async () => {
    const { container, detectChanges } = await render(HeroHostComponent);
    const hero = container.querySelector<HTMLElement>('.hero');

    shareOnNextRoute(document.createElement('img'), 'cantharellus-cibarius');
    detectChanges();

    expect(hero?.style.getPropertyValue('view-transition-name')).toBe('');
    attachSharedElement(transitionDouble().transition, true);
  });
});
